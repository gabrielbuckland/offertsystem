import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { berechneVerkaufssumme } from '../../src/pipeline/stufe2-verkaufssumme.js';
import { toleranzFuer } from '../../src/config/toleranzen.js';
import { einTypEinheitenEingang } from './generatoren.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

describe('I-05 Referenztreue (Property)', () => {
  it('Einheit mit Referenzflaechen und ohne Anpassungen erhaelt exakt den Referenzwert', () => {
    expect(toleranzFuer('I-05').typ).toBe('exakt');
    pruefeProperty('I-05', konfig.numRuns, () => {
      fc.assert(
        fc.property(
          fc.double({ min: 20, max: 300, noNaN: true }),          // A_ref_innen
          fc.double({ min: 0, max: 60, noNaN: true }),            // A_ref_aussen
          fc.integer({ min: 20_000_000, max: 500_000_000 }),      // P_ref in Rappen
          fc.double({ min: 0, max: 1, noNaN: true }),             // alpha
          (innen, aussen, pRef, alpha) => {
            const e = einTypEinheitenEingang({ innen, aussen, pRef, alpha, anpassungen: [] });
            const r = berechneVerkaufssumme(e);
            if (!r.ok) return innen + alpha * aussen === 0; // nur S-04 darf scheitern
            return r.wert.positionen.every((p) => p.preis === pRef);
          },
        ),
      );
    });
  });
});
