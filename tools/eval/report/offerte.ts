// PE-04: prueft den Konfigurationsbezug der Beispiel-Offerte. konfig_sha256 des Laufkopfs
// (Hash ueber die Datei) und konfigPruefsumme der Offerte (Hash ueber die effektive,
// serialisierte Konfiguration inkl. Ueberschreibungen, E-26) koennen nie gleich sein —
// verglichen wird deshalb ueber die Konfigurationsversion plus Vorhandensein der Kopie.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface OffertPruefung {
  readonly pfad: string;
  readonly konfigVersion: string;
  readonly konfigPruefsumme: string;
}

export function pruefeBeispielOfferte(
  wurzel: string,
  erwartet: { readonly konfigVersion: string },
): OffertPruefung {
  const ordner = join(wurzel, 'data', 'offerten');
  if (!existsSync(ordner)) {
    throw new Error('data/offerten fehlt — die Beispiel-Offerte stammt aus P4');
  }
  const dateien = readdirSync(ordner).filter((n) => n.endsWith('.json')).sort();
  if (dateien.length === 0) {
    throw new Error('Keine Beispiel-Offerte in data/offerten — erzeugt von P4');
  }
  const pfad = join(ordner, dateien[0]!);
  const offerte = JSON.parse(readFileSync(pfad, 'utf8')) as {
    metadata?: { konfigPruefsumme?: string; konfigVersion?: string };
    konfigurationsAbdruck?: unknown;
  };
  const abdruck = offerte.metadata === undefined
    ? undefined
    : (offerte.konfigurationsAbdruck ?? (offerte.metadata as {
        konfigurationsAbdruck?: unknown;
      }).konfigurationsAbdruck);
  if (abdruck === undefined || abdruck === null
      || Object.keys(abdruck as object).length === 0) {
    throw new Error(`${pfad}: konfigurationsAbdruck fehlt oder ist leer (E-26)`);
  }
  const version = offerte.metadata?.konfigVersion;
  if (version !== erwartet.konfigVersion) {
    throw new Error(
      `${pfad}: konfigVersion ${String(version)} weicht von der Konfiguration des Laufs `
      + `(${erwartet.konfigVersion}) ab. Die Beispiel-Offerte stammt aus einem anderen `
      + 'Konfigurationsstand; A5 wuerde einen falschen Bezug behaupten.',
    );
  }
  return {
    pfad,
    konfigVersion: version,
    konfigPruefsumme: offerte.metadata?.konfigPruefsumme ?? '',
  };
}
