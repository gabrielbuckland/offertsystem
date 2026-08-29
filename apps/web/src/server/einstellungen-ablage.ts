// Schreibweg der firmenweiten Ebene (Spec §6, I-21): geschrieben wird erst NACH bestandener
// Validierung, kein --force, kein Warnmodus. Vorversion wandert zeitgestempelt nach `backups/`.
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

// `KONFIG_VORLAGEN` deckt nur 3 der 23 CFG_*-Codes ab; fuer die uebrigen (u. a.
// CFG_TIER_DEGRESSION, CFG_SCHEMA_TYPE) faellt der Text unten auf Code+Rohparameter zurueck
// statt auf einen Satz (E-03). Vervollstaendigung bewusst nicht hier erledigt (gehoert
// fehlertexte.ts/anderer Spur) — Folgeposten, Ruecksprache Auftraggeber 2026-08-25.
function textFuer(befund: KonfigurationsFehler): string {
  if (istUebersetzbar(befund.code)) {
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

function zuBefunden(fehler: readonly KonfigurationsFehler[]): EinstellungsBefund[] {
  return fehler.map((f) => ({ pfad: f.pfad, text: textFuer(f) }));
}

const MAX_SICHERUNGS_VERSUCHE = 1000;

// Eigener Typ statt generischem `Error`, damit `schreibeCompanyDefaults` diesen Fall von
// echten I/O-Fehlern unterscheiden und in einen `befund` statt einer 500 umwandeln kann.
class SicherungsKollisionError extends Error {
  constructor(sicherungsVerzeichnis: string, zeitstempel: string) {
    super(
      `Kein freier Sicherungsname in ${sicherungsVerzeichnis} fuer ${zeitstempel} gefunden `
      + `(${MAX_SICHERUNGS_VERSUCHE} Zaehlerstaende belegt).`,
    );
    this.name = 'SicherungsKollisionError';
  }
}

// Kollisionssicher statt auf Zufall vertrauend: zwei Schreibvorgaenge in derselben
// Millisekunde erhalten sonst denselben Dateinamen und ein zweites `copyFile` ueberschriebe
// die erste Sicherung still (Spec §6). Deshalb `COPYFILE_EXCL` plus Zaehlersuffix bei
// Kollision, gedeckelt durch `MAX_SICHERUNGS_VERSUCHE` statt unbegrenzter Anfrage.
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

  // Leert den GESAMTEN Lader-Cache (keine gezielte Invalidierung verfuegbar), noetig weil der
  // Cache mtime UND Groesse vergleicht und ein schneller Schreib-/Ladevorgang sonst denselben
  // gerundeten Zeitstempel traegt.
  leereZwischenspeicher();
  const neu = ladeKonfiguration({ pfad });
  if (!neu.ok) {
    // Schutz gegen die Luecke zwischen Validierung und Ladepfad: Sicherung kehrt zurueck,
    // ueber `schreibeAtomar` statt direktem `copyFile`, damit ein Absturz mitten im Restore
    // die Datei nicht in einem unbrauchbaren Zwischenzustand zurueck liesse.
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
