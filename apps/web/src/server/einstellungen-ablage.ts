/**
 * Schreibweg der firmenweiten Ebene (Spec §6). Zurueckweisen statt melden: geschrieben
 * wird erst NACH bestandener Validierung — es existiert kein Zeitfenster, in dem eine
 * unzulaessige Datei aktiv waere (I-21). Kein --force, kein Warnmodus.
 *
 * Die Vorversion wandert zeitgestempelt nach `backups/` neben der Datei — kein
 * Versionsverlauf, nur die Ruecksprungmarke fuer den Auftraggeber (Spec §6).
 */
import { constants as fsKonstanten } from 'node:fs';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { validiereKonfiguration, type KonfigurationsFehler } from '@offert/core';
import { schreibeAtomar } from './ablage-helfer.js';
import { KONFIG_VORLAGEN, uebersetzeKonfigFehler } from './fehlertexte.js';
import { ladeKonfiguration, leereZwischenspeicher } from './konfigurations-lader.js';

export type EinstellungsBefund = { readonly pfad: string; readonly text: string };
export type SchreibErgebnis =
  | { readonly ok: true; readonly pruefsumme: string }
  | { readonly ok: false; readonly befunde: readonly EinstellungsBefund[] };

function istUebersetzbar(code: string): code is keyof typeof KONFIG_VORLAGEN {
  return Object.hasOwn(KONFIG_VORLAGEN, code);
}

/**
 * `KONFIG_VORLAGEN` (fehlertexte.ts) deckt nur 3 der 23 CFG_*-Codes ab
 * (CFG_STRATEGY_UNKNOWN, CFG_TIER_ORDER, CFG_TIER_OPEN); die uebrigen 20 — darunter genau die
 * in dieser Task ausgeloesten CFG_TIER_DEGRESSION und CFG_SCHEMA_TYPE — haben dort KEINE
 * eigene Anzeigevorlage. Der folgende Zweig ist deshalb ein Notbehelf, nicht der
 * vorgesehene Weg: Ohne Vorlage sieht der Vermarkter Code + Rohparameter statt eines Satzes,
 * genau die Rohform, die die Uebersetzungsschicht (E-03) eigentlich vermeiden soll. Die
 * Tabelle wird hier NICHT erweitert (fehlertexte.ts gehoert einer anderen Spur/Task 12 und
 * eine Erweiterung hier riskierte einen Merge-Konflikt) — die Vervollstaendigung ist als
 * Folgeposten vermerkt (Ruecksprache Auftraggeber, 2026-08-25). Der `pfad` — der Feldanker
 * der Editoren — bleibt in jedem Fall der aus dem `KonfigurationsFehler`, unabhaengig davon,
 * welcher Zweig den Text liefert.
 */
function textFuer(befund: KonfigurationsFehler): string {
  if (istUebersetzbar(befund.code)) {
    // `Fehlerparameter` (Kern) und der `Parameter`-Typ der Uebersetzungsschicht ueberschneiden
    // sich nicht deckungsgleich (Boolean vs. String-Array als Wertetyp); ueber den Signatur-
    // Typ von `uebersetzeKonfigFehler` statt eines eigenen (nicht exportierten) Typnamens
    // bleibt die Umwandlung an der tatsaechlichen Funktionssignatur verankert.
    // TODO(KONFIG_VORLAGEN-Vervollstaendigung, Folgeposten oben): Sollte `Parameter` je einen
    // Boolean-Wert fuehren, waere dieser Cast eine stille Typluecke — heute unschaedlich, weil
    // keiner der drei abgedeckten Codes einen Boolean-Parameter traegt.
    const parameter = befund.parameter as unknown as Parameters<typeof uebersetzeKonfigFehler>[1];
    return uebersetzeKonfigFehler(befund.code, parameter).text;
  }
  const parameter = Object.entries(befund.parameter)
    .map(([schluessel, wert]) => `${schluessel}=${String(wert)}`)
    .join(', ');
  return parameter === '' ? befund.code : `${befund.code}: ${parameter}`;
}

/**
 * DER Uebersetzungsweg von `KonfigurationsFehler` nach `EinstellungsBefund` — exportiert,
 * damit ihn auch die projektbezogene Schreibroute (`api/projekt/[id]/einstellungen`)
 * benutzt statt eines eigenen. Zwei Wege haetten fuer denselben Fehler zwei Ergebnisse
 * geliefert: hier Feldpfad plus Anzeigefassung, dort ein pauschaler Formularanker und die
 * Rohform aus `laufzeit.ts` — und die Editoren koennten den zweiten nirgends verankern.
 */
export function zuBefunden(fehler: readonly KonfigurationsFehler[]): EinstellungsBefund[] {
  return fehler.map((f) => ({ pfad: f.pfad, text: textFuer(f) }));
}

/** Obergrenze der Zaehlersuffixe in `sichereVorversion` — siehe deren Kommentar. */
const MAX_SICHERUNGS_VERSUCHE = 1000;

/**
 * Wird geworfen, wenn `sichereVorversion` innerhalb von `MAX_SICHERUNGS_VERSUCHE`
 * Versuchen keinen freien Sicherungsnamen findet. Ein eigener Typ statt eines generischen
 * `Error`, damit `schreibeCompanyDefaults` genau diesen Fall von echten I/O-Fehlern
 * unterscheiden und in einen `befund` statt einer 500 umwandeln kann.
 */
class SicherungsKollisionError extends Error {
  constructor(sicherungsVerzeichnis: string, zeitstempel: string) {
    super(
      `Kein freier Sicherungsname in ${sicherungsVerzeichnis} fuer ${zeitstempel} gefunden `
      + `(${MAX_SICHERUNGS_VERSUCHE} Zaehlerstaende belegt).`,
    );
    this.name = 'SicherungsKollisionError';
  }
}

/**
 * Sichert `pfad` zeitgestempelt nach `sicherungsVerzeichnis`. Kollisionssicher statt auf
 * den Zufall vertrauend: Zwei Schreibvorgaenge innerhalb derselben Millisekunde traegen
 * sonst denselben Dateinamen, und ein zweites `copyFile` ueberschriebe die erste Sicherung
 * stillschweigend — genau der Verlust, den `backups/` verhindern soll (Spec §6). Der Fang
 * versucht deshalb `COPYFILE_EXCL` (schlaegt fehl statt zu ueberschreiben) und haengt bei
 * Kollision einen Zaehlersuffix an, bis ein freier Name gefunden ist.
 *
 * Die Schleife ist mit `MAX_SICHERUNGS_VERSUCHE` gedeckelt: Ohne Obergrenze haengte eine
 * verschmutzte oder fehlerhaft befuellte `backups/`, die jeden Zaehlerstand fuer einen
 * Zeitstempel bereits belegt, die Anfrage unbegrenzt auf statt sie zurueckzuweisen.
 */
async function sichereVorversion(
  pfad: string, sicherungsVerzeichnis: string, zeitstempel: string,
): Promise<string> {
  for (let zaehler = 0; zaehler <= MAX_SICHERUNGS_VERSUCHE; zaehler += 1) {
    const name = zaehler === 0 ? `${zeitstempel}.json` : `${zeitstempel}-${zaehler}.json`;
    const ziel = join(sicherungsVerzeichnis, name);
    try {
      await fs.copyFile(pfad, ziel, fsKonstanten.COPYFILE_EXCL);
      return ziel;
    } catch (fehler) {
      if ((fehler as NodeJS.ErrnoException).code !== 'EEXIST') throw fehler;
      // Name bereits vergeben (Millisekunden-Kollision oder Verzeichnisverschmutzung) —
      // naechster Zaehlerstand.
    }
  }
  throw new SicherungsKollisionError(sicherungsVerzeichnis, zeitstempel);
}

export async function schreibeCompanyDefaults(
  roh: unknown, pfad: string,
): Promise<SchreibErgebnis> {
  const ergebnis = validiereKonfiguration(roh);
  if (!ergebnis.ok) {
    return { ok: false, befunde: zuBefunden(ergebnis.fehler) };
  }

  const sicherungsVerzeichnis = join(dirname(pfad), 'backups');
  await fs.mkdir(sicherungsVerzeichnis, { recursive: true });
  const zeitstempel = new Date().toISOString().replace(/:/g, '-');
  let sicherung: string;
  try {
    sicherung = await sichereVorversion(pfad, sicherungsVerzeichnis, zeitstempel);
  } catch (fehler) {
    if (!(fehler instanceof SicherungsKollisionError)) throw fehler;
    // Zurueckweisen statt melden gilt auch hier: Vor diesem Punkt wurde nichts an `pfad`
    // geschrieben, also bleibt die Datei unangetastet.
    return {
      ok: false,
      befunde: [{
        pfad: '(datei)',
        text: 'Es konnte kein freier Name fuer die Sicherung der Vorversion gefunden werden; '
          + 'die Konfiguration wurde nicht geschrieben.',
      }],
    };
  }

  await schreibeAtomar(pfad, `${JSON.stringify(roh, null, 2)}\n`);

  // `leereZwischenspeicher()` leert den GESAMTEN prozessweiten Lader-Cache, nicht nur den
  // Eintrag fuer `pfad` (der Lader bietet keine gezielte Invalidierung an). Unter dem
  // aktuellen Ein-Datei-Modell (nur `company-defaults.json`) harmlos; sollte der Lader je
  // mehrere Pfade bedienen, traefe dieser Aufruf auch deren Cache-Eintraege.
  //
  // Grund fuer den Aufruf ueberhaupt: Der Cache vergleicht mtime UND Groesse; ein Leeren
  // hier schliesst eine Luecke, in der eine sehr rasche Aufeinanderfolge von Schreib- und
  // Ladevorgang auf demselben Pfad denselben (gerundeten) Zeitstempel traegt.
  leereZwischenspeicher();
  const neu = ladeKonfiguration({ pfad });
  if (!neu.ok) {
    // Schutz gegen die Luecke zwischen Validierung und Ladepfad (sollte diese
    // Konfiguration wider Erwarten den Kern-Check bestehen, aber der Lader sie
    // dennoch zurueckweisen): Die Sicherung kehrt zurueck. Ueber `schreibeAtomar` statt
    // eines direkten `copyFile` — ein Absturz mitten in einem direkten Restore liesse die
    // Datei weder im alten noch im neuen Zustand zurueck, genau der Verlust, den diese
    // Wiederherstellung eigentlich verhindern soll.
    await schreibeAtomar(pfad, await fs.readFile(sicherung, 'utf8'));
    leereZwischenspeicher();
    return {
      ok: false,
      befunde: [{
        pfad: '(datei)',
        text: 'Die neue Konfiguration liess sich nach dem Schreiben nicht laden; '
          + 'die Vorversion wurde wiederhergestellt.',
      }],
    };
  }

  return { ok: true, pruefsumme: neu.fingerabdruck.konfigPruefsumme };
}
