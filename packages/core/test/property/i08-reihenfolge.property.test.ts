import fc from 'fast-check';
import { describe, it } from 'vitest';
import { berechneVerkaufssumme } from '../../src/pipeline/stufe2-verkaufssumme.js';
import { einTypEinheitenEingang } from './generatoren.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

describe('I-08 Reihenfolgeunabhaengigkeit der Zu-/Abschlaege (Property)', () => {
  it('Liste und Permutation liefern denselben Preis', () => {
    pruefeProperty('I-08', konfig.numRuns, () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: -0.4, max: 0.4, noNaN: true }), { minLength: 1, maxLength: 8 })
            .filter((xs) => {
              const s = xs.reduce((a, b) => a + b, 0);
              return s > -1 && s >= -0.25 && s <= 0.25;
            }),
          (faktoren) => {
            const anpassungen = faktoren.map((f, i) => ({
              faktor: f, begruendung: `Begruendung Nummer ${i} zur Anpassung`,
              erfassungsform: 'relativ' as const,
            }));
            const original = berechneVerkaufssumme(einTypEinheitenEingang({ anpassungen }));
            const permutiert = berechneVerkaufssumme(
              einTypEinheitenEingang({ anpassungen: [...anpassungen].reverse() }));
            if (!original.ok || !permutiert.ok) return false;
            return original.wert.positionen[0]!.preis === permutiert.wert.positionen[0]!.preis;
          },
        ),
      );
    });
  });
});
