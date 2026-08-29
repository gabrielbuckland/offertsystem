import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  werteBereichsregelAus, type Bereich,
} from '../../src/modell/bereichsregel.js';

/** Erzeugt nur gueltige Staffeln: streng aufsteigende Schwellen plus Restfall. */
const staffelArb = fc.tuple(
  fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 0, maxLength: 6 }),
  fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 7, maxLength: 7 }),
).map(([schwellen, werte]): readonly Bereich[] => {
  const sortiert = [...schwellen].sort((a, b) => a - b);
  return [
    ...sortiert.map((unter, i) => ({ unter, wert: werte[i]! })),
    { wert: werte[6]! },
  ];
});

describe('Bereichsregel — Eigenschaften', () => {
  it('ist total: jeder endliche Merkmalswert trifft genau einen Bereich', () => {
    fc.assert(fc.property(staffelArb, fc.integer({ min: -200, max: 200 }), (bereiche, wert) => {
      const treffer = werteBereichsregelAus({ merkmal: 'm', bereiche }, wert);
      expect(treffer.bereich).toBeGreaterThanOrEqual(0);
      expect(treffer.bereich).toBeLessThan(bereiche.length);
      expect(treffer.wert).toBe(bereiche[treffer.bereich]!.wert);
    }));
  });

  it('ist monoton im Index: ein groesserer Merkmalswert trifft nie einen frueheren Bereich', () => {
    fc.assert(fc.property(
      staffelArb,
      fc.integer({ min: -200, max: 200 }),
      fc.integer({ min: -200, max: 200 }),
      (bereiche, a, b) => {
        const [klein, gross] = a <= b ? [a, b] : [b, a];
        const regel = { merkmal: 'm', bereiche };
        expect(werteBereichsregelAus(regel, klein).bereich)
          .toBeLessThanOrEqual(werteBereichsregelAus(regel, gross).bereich);
      },
    ));
  });
});
