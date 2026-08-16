import fc from 'fast-check';
import { describe, it } from 'vitest';
import { berechneAufwandindikator } from '../../src/pipeline/stufe4-gewichtung.js';
import { toleranzFuer } from '../../src/config/toleranzen.js';
import { faktormengeMitGewichtssummeEins, normalisierungZu } from './generatoren.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

describe('I-12 Summe w_d = 1 impliziert D in [0,1] (Property)', () => {
  it('haelt fuer Faktormengen der Groesse 1..12', () => {
    const t = toleranzFuer('I-12').wert;
    pruefeProperty('I-12', konfig.numRuns, () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.01, max: 1, noNaN: true }), { minLength: 1, maxLength: 12 }),
          fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 12 }),
          (rohGewichte, normierte) => {
            const konfiguration = faktormengeMitGewichtssummeEins(rohGewichte);
            const n = normalisierungZu(konfiguration, normierte);
            const r = berechneAufwandindikator(n, konfiguration);
            if (!r.ok) return false;
            return r.wert.aufwandindikator >= -t && r.wert.aufwandindikator <= 1 + t;
          },
        ),
      );
    });
  });
});
