import fc from 'fast-check';
import { describe, it } from 'vitest';
import { bildeHonorarrange } from '../../src/pipeline/stufe5-honorar.js';
import { rangeBreiteToleranz } from '../../src/config/toleranzen.js';
import { gewichtungErgebnis, standardKonfiguration, verkaufssummeErgebnis } from '../helper/projekt.js';
import { rappen } from '../../src/domain/geld.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

describe('I-17 g(D) als gemeinsamer Faktor erhaelt die relative Range-Breite (Property)', () => {
  it('die relative Breite ist von D unabhaengig, bis auf einen Rappen je Randwert', () => {
    const k = standardKonfiguration();
    pruefeProperty('I-17', konfig.numRuns, () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20_000_000_000 }),
          fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
          (v, d1, d2) => {
            const a = bildeHonorarrange(verkaufssummeErgebnis(rappen(v)), gewichtungErgebnis(d1), k);
            const b = bildeHonorarrange(verkaufssummeErgebnis(rappen(v)), gewichtungErgebnis(d2), k);
            if (!a.ok || !b.ok) return false;
            const wa = (a.wert.honorarMax - a.wert.honorarMin) / a.wert.honorarMin;
            const wb = (b.wert.honorarMax - b.wert.honorarMin) / b.wert.honorarMin;
            const schranke = rangeBreiteToleranz(Math.min(a.wert.honorarMin, b.wert.honorarMin),
              Math.max(wa, wb));
            return Math.abs(wa - wb) <= schranke;
          },
        ),
      );
    });
  });
});
