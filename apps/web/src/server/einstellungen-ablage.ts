/**
 * Schreibweg der firmenweiten Ebene (Spec §6). Zurueckweisen statt melden: geschrieben
 * wird erst NACH bestandener Validierung — es existiert kein Zeitfenster, in dem eine
 * unzulaessige Datei aktiv waere (I-21). Kein --force, kein Warnmodus.
 *
 * Die Vorversion wandert zeitgestempelt nach `backups/` neben der Datei — kein
 * Versionsverlauf, nur die Ruecksprungmarke fuer den Auftraggeber (Spec §6).
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { validiereKonfiguration, type KonfigurationsFehler } from '@offert/core';
import { KONFIG_VORLAGEN, uebersetzeKonfigFehler } from './fehlertexte.js';
import { ladeKonfiguration, leereZwischenspeicher } from './konfigurations-lader.js';

export type EinstellungsBefund = { readonly pfad: string; readonly text: string };
export type SchreibErgebnis =
  | { readonly ok: true; readonly pruefsumme: string }
  | { readonly ok: false; readonly befunde: readonly EinstellungsBefund[] };

async function schreibeAtomar(ziel: string, inhalt: string): Promise<void> {
  const temp = `${ziel}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, inhalt, 'utf8');
  try {
    await fs.rename(temp, ziel);
  } catch (fehler) {
    await fs.rm(temp, { force: true });
    throw fehler;
  }
}

function istUebersetzbar(code: string): code is keyof typeof KONFIG_VORLAGEN {
  return Object.hasOwn(KONFIG_VORLAGEN, code);
}

/**
 * `KONFIG_VORLAGEN` (fehlertexte.ts) deckt nur einen Teil des CFG_*-Namensraums ab —
 * die uebrigen Codes (z. B. CFG_TIER_DEGRESSION, CFG_SCHEMA_TYPE) haben dort keine
 * eigene Anzeigevorlage. Die Datei ist eine bestehende Datei einer anderen Spur
 * (Task 12) und wird hier nicht erweitert; fuer Codes ohne Vorlage traegt der
 * Befundtext ersatzweise Code und Parameter. Der `pfad` — der Feldanker der
 * Editoren — bleibt in jedem Fall der aus dem `KonfigurationsFehler`.
 */
function textFuer(befund: KonfigurationsFehler): string {
  if (istUebersetzbar(befund.code)) {
    // `Fehlerparameter` (Kern) und der `Parameter`-Typ der Uebersetzungsschicht ueberschneiden
    // sich nicht deckungsgleich (Boolean vs. String-Array als Wertetyp); ueber den Signatur-
    // Typ von `uebersetzeKonfigFehler` statt eines eigenen (nicht exportierten) Typnamens
    // bleibt die Umwandlung an der tatsaechlichen Funktionssignatur verankert.
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
  const sicherung = join(sicherungsVerzeichnis, `${zeitstempel}.json`);
  await fs.copyFile(pfad, sicherung);

  await schreibeAtomar(pfad, `${JSON.stringify(roh, null, 2)}\n`);

  // Der Prozesscache des Laders vergleicht mtime UND Groesse; ein Leeren hier
  // schliesst eine Luecke, in der eine sehr rasche Aufeinanderfolge von Schreib-
  // und Ladevorgang auf demselben Pfad denselben (gerundeten) Zeitstempel traegt.
  leereZwischenspeicher();
  const neu = ladeKonfiguration({ pfad });
  if (!neu.ok) {
    // Schutz gegen die Luecke zwischen Validierung und Ladepfad (sollte diese
    // Konfiguration wider Erwarten den Kern-Check bestehen, aber der Lader sie
    // dennoch zurueckweisen): Die Sicherung kehrt zurueck, die Datei bleibt gueltig.
    await fs.copyFile(sicherung, pfad);
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
