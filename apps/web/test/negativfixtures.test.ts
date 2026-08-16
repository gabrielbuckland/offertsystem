import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validiereKonfiguration } from '@offert/core';

const VERZEICHNIS = resolve(
  import.meta.dirname,
  '../../../packages/core/test/fixtures/config-invalid',
);

const ERWARTUNG: ReadonlyArray<readonly [string, string]> = [
  ['alpha-out-of-range.json', 'CFG_ALPHA_RANGE'],
  ['weights-sum-not-one.json', 'CFG_WEIGHTS_SUM'],
  ['weight-negative.json', 'CFG_WEIGHT_RANGE'],
  ['g-range-invalid.json', 'CFG_G_RANGE'],
  ['stufen-nicht-aufsteigend.json', 'CFG_TIER_ORDER'],
  ['degression-stufe-verletzt.json', 'CFG_TIER_DEGRESSION'],
  ['netto-degression-verletzt.json', 'CFG_NET_DEGRESSION'],
  ['norm-bounds-equal.json', 'CFG_NORM_BOUNDS'],
  ['zuschlag-bounds-invalid.json', 'CFG_ADJUSTMENT_BOUNDS'],
];

describe('Negativfixtures der Konfigurationsvalidierung', () => {
  it.each(ERWARTUNG)('%s wird mit %s zurueckgewiesen', (datei, erwarteterCode) => {
    const roh: unknown = JSON.parse(readFileSync(resolve(VERZEICHNIS, datei), 'utf8'));
    const ergebnis = validiereKonfiguration(roh);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain(erwarteterCode);
    // Kein Teilergebnis: das Ergebnisobjekt traegt keinen Wert.
    expect(Object.hasOwn(ergebnis, 'wert')).toBe(false);
  });

  it('jede Meldung nennt Ort und konkrete Zahlen', () => {
    for (const [datei] of ERWARTUNG) {
      const roh: unknown = JSON.parse(readFileSync(resolve(VERZEICHNIS, datei), 'utf8'));
      const ergebnis = validiereKonfiguration(roh);
      expect(ergebnis.ok).toBe(false);
      if (ergebnis.ok) continue;
      for (const befund of ergebnis.fehler) {
        expect(befund.pfad.length).toBeGreaterThan(0);
        expect(Object.keys(befund.parameter).length).toBeGreaterThan(0);
      }
    }
  });
});
