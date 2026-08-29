import fc from 'fast-check';
import { describe, it } from 'vitest';
import { loeseStrategieAuf } from '../../src/normalization/registry.js';
import { faktorId } from '../../src/domain/ids.js';
import { gewicht } from '../../src/domain/geld.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

const grenze = fc.double({ min: -1e6, max: 1e6, noNaN: true });
const parameter = (min: number, max: number) => ({
  grenzeMin: min, grenzeMax: max, gewicht: gewicht(0.5), strategie: 'min-max' as const,
  quelle: 'manuell' as const, quellSchluessel: 'f', bezeichnung: 'Testfaktor',
});

describe('I-10 Zielintervall und I-11 Kappung (Property)', () => {
  it('I-10: jedes Ergebnis liegt exakt in [0, 1], beide Polungen', () => {
    pruefeProperty('I-10', konfig.numRuns, () => {
      fc.assert(
        fc.property(grenze, grenze, grenze, (roh, min, max) => {
          fc.pre(min !== max);
          const r = loeseStrategieAuf('min-max').normalisiere(roh, parameter(min, max), faktorId('f'));
          return r.ok && r.wert.normiert >= 0 && r.wert.normiert <= 1;
        }),
      );
    });
  });

  it('I-11: Rohwerte ausserhalb der Grenzen liefern genau 0 oder 1 und sind markiert', () => {
    pruefeProperty('I-11', konfig.numRuns, () => {
      fc.assert(
        fc.property(grenze, grenze, fc.double({ min: 0.001, max: 1e5, noNaN: true }), fc.boolean(),
          (min, max, abstand, oben) => {
            fc.pre(min !== max);
            const untere = Math.min(min, max);
            const obere = Math.max(min, max);
            const roh = oben ? obere + abstand : untere - abstand;
            const r = loeseStrategieAuf('min-max').normalisiere(roh, parameter(min, max), faktorId('f'));
            if (!r.ok) return false;
            return r.wert.gekappt && (r.wert.normiert === 0 || r.wert.normiert === 1);
          }),
      );
    });
  });
});
