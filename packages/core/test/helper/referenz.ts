/**
 * Leser der unabhaengig gerechneten Erwartungswerte der Szenarien (T2).
 *
 * Prueft vor jedem Zugriff die SHA-256-Summe der CSV-Datei gegen `manifest.json`.
 * Ohne diese Pruefung koennte ein Erwartungswert unbemerkt an ein geaendertes
 * Rechenergebnis angepasst werden — der Vergleich verglichte dann die
 * Implementierung mit sich selbst und belegte nichts mehr.
 *
 * Der Zugriff auf `node:fs` ist hier zulaessig: Die Sperre aus R1 gilt fuer
 * `packages/core/src/**`, nicht fuer die Testseite.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERZEICHNIS = resolve(import.meta.dirname, '../fixtures/reference');

export type ReferenzZeile = Readonly<Record<string, string>>;

interface ManifestEintrag {
  readonly blatt: string;
  readonly csv: string;
  readonly sha256: string;
}

interface Manifest {
  readonly blaetter: readonly ManifestEintrag[];
}

const manifest = JSON.parse(
  readFileSync(resolve(VERZEICHNIS, 'manifest.json'), 'utf8'),
) as Manifest;

export function ladeReferenz(blatt: string): readonly ReferenzZeile[] {
  const eintrag = manifest.blaetter.find((b) => b.blatt === blatt);
  if (eintrag === undefined) {
    throw new Error(`Kein Manifesteintrag zum Referenzblatt ${blatt}`);
  }
  const pfad = resolve(VERZEICHNIS, eintrag.csv);
  const roh = readFileSync(pfad);
  const ist = createHash('sha256').update(roh).digest('hex');
  if (ist !== eintrag.sha256) {
    throw new Error(
      `Pruefsumme von ${eintrag.csv} weicht ab: erwartet ${eintrag.sha256}, erhalten ${ist}. `
      + 'Die Referenzausleitung wurde veraendert, ohne das Manifest nachzufuehren.',
    );
  }

  const zeilen = roh.toString('utf8').trimEnd().split('\n');
  const kopf = zeilen[0]!.split(',');
  return zeilen.slice(1).map((zeile) => {
    const felder = zerlege(zeile);
    return Object.fromEntries(kopf.map((name, i) => [name, felder[i] ?? '']));
  });
}

/** Minimales CSV-Zerlegen mit Anfuehrungszeichen; die Ausleitung kennt keine Zeilenumbrueche in Feldern. */
function zerlege(zeile: string): readonly string[] {
  const felder: string[] = [];
  let aktuell = '';
  let inAnfuehrung = false;
  for (let i = 0; i < zeile.length; i += 1) {
    const zeichen = zeile[i]!;
    if (inAnfuehrung) {
      if (zeichen === '"' && zeile[i + 1] === '"') { aktuell += '"'; i += 1; }
      else if (zeichen === '"') inAnfuehrung = false;
      else aktuell += zeichen;
    } else if (zeichen === '"') inAnfuehrung = true;
    else if (zeichen === ',') { felder.push(aktuell); aktuell = ''; }
    else aktuell += zeichen;
  }
  felder.push(aktuell);
  return felder;
}
