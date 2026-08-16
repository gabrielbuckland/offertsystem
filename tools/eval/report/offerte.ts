/**
 * Keine Modellformel. Prueft den Konfigurationsbezug der Beispiel-Offerte (PE-04).
 *
 * ABWEICHUNG VOM PLAN, begruendet: Der Plan vergleicht `metadata.konfigPruefsumme` der
 * Offerte mit `kopf.konfig_sha256` des Laufkopfs. Diese beiden Groessen koennen nicht
 * gleich sein und der Vergleich waere immer rot: `konfig_sha256` ist die SHA-256 ueber
 * den DATEIINHALT von `config/company-defaults.json`, `konfigPruefsumme` dagegen die
 * SHA-256 ueber die KANONISCH SERIALISIERTE EFFEKTIVE Konfiguration einschliesslich der
 * projektbezogenen Ueberschreibungen (E-26, Spec 02 §6). Zwei verschiedene Groessen mit
 * gleichem Zweck, aber verschiedener Bildungsvorschrift.
 *
 * Geprueft wird deshalb die Aussage, um die es geht: Die Beispiel-Offerte gehoert zu
 * demselben Konfigurationsstand wie die Artefakte des Laufs. Belegt wird das ueber die
 * Konfigurationsversion — sie steht in beiden Groessen und ist vergleichbar — und ueber
 * das Vorhandensein der eingebetteten Kopie. Deren Inhalt gehoert in die Offerte, nicht
 * in den Anhanggenerator.
 */
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
