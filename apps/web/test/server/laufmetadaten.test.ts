import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bildePruefsumme, kanonischSerialisieren } from '../../src/server/kanonisch.js';
import type { KonfigurationsFingerabdruck } from '../../src/server/konfigurations-lader.js';
import { erzeugeLaufmetadaten } from '../../src/server/laufmetadaten.js';
import { holeLaufzeit } from '../../src/server/laufzeit.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');

const FESTE_QUELLE = {
  neueId: () => 'offerte-014',
  naechsteReferenznummer: () => 'A-2026-014',
  jetzt: () => '2026-08-16T14:32:00.000Z',
};

const FINGERABDRUCK: KonfigurationsFingerabdruck = {
  konfigVersion: '1.2.0',
  schemaVersion: 1,
  konfigPruefsumme: 'a'.repeat(64),
  ueberschreibungen: [],
};

const TEST_UMGEBUNG = {
  VALUATION_PROVIDER: 'mock',
  COMPANY_DEFAULTS_PATH: `${WURZEL}/config/company-defaults.json`,
  OFFERTEN_VERZEICHNIS: './tmp/offerten',
};

describe('erzeugeLaufmetadaten (E-29)', () => {
  it('uebernimmt Bezeichner und Zeitstempel aus der Quelle, statt sie selbst zu erzeugen', () => {
    expect(erzeugeLaufmetadaten(FINGERABDRUCK, FESTE_QUELLE)).toEqual({
      offertId: 'offerte-014',
      referenznummer: 'A-2026-014',
      erstelltAm: '2026-08-16T14:32:00.000Z',
      konfigVersion: '1.2.0',
      konfigPruefsumme: 'a'.repeat(64),
    });
  });

  it('liefert bei identischer Quelle identische Metadaten (Voraussetzung von I-14)', () => {
    expect(erzeugeLaufmetadaten(FINGERABDRUCK, FESTE_QUELLE))
      .toEqual(erzeugeLaufmetadaten(FINGERABDRUCK, FESTE_QUELLE));
  });
});

describe('Genau eine Pruefsummenbildung (PE-04)', () => {
  it('bildet keine zweite Pruefsumme neben dem Lader', () => {
    // Fails if second hash creation emerges; referenz.ts only hashes CSV integrity.
    const treffer = execSync('grep -rln "createHash" apps/web/src packages/*/src || true',
      { encoding: 'utf8', cwd: WURZEL }).trim().split('\n').filter((z) => z !== '');
    expect(treffer).toEqual(['apps/web/src/server/kanonisch.ts']);
  });

  it('haelt Hash-Bildung aus packages/core heraus', () => {
    const treffer = execSync('grep -rl "createHash\\|node:crypto" packages/core/src || true',
      { encoding: 'utf8', cwd: WURZEL }).trim();
    expect(treffer).toBe('');
  });
});

describe('Die Pruefsumme wandert unveraendert in die Offerte (E-26)', () => {
  it('traegt in die Metadaten dieselbe Pruefsumme, die der Lader gebildet hat', () => {
    const laufzeit = holeLaufzeit(TEST_UMGEBUNG);
    expect(laufzeit.ok).toBe(true);
    if (!laufzeit.ok) return;
    const meta = erzeugeLaufmetadaten(laufzeit.wert.fingerabdruck, FESTE_QUELLE);
    expect(meta.konfigPruefsumme).toBe(laufzeit.wert.fingerabdruck.konfigPruefsumme);
  });

  it('aendert die Pruefsumme, sobald ein Berechnungsparameter wechselt', () => {
    const a = bildePruefsumme(kanonischSerialisieren({ flaeche: { alpha: 0.5 } }));
    const b = bildePruefsumme(kanonischSerialisieren({ flaeche: { alpha: 0.51 } }));
    expect(a).not.toBe(b);
  });
});
