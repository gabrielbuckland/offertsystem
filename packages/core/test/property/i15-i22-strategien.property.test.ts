import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { alleStrategien } from '../../src/modell/normalisierung.js';
import { skalierung } from '../../src/modell/skalierung.js';
import { toleranzFuer } from '../../src/config/toleranzen.js';
import { faktorId } from '../../src/domain/ids.js';
import { gewicht } from '../../src/domain/geld.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

describe('I-15 Monotonie von g (Property)', () => {
  it('D1 <= D2 impliziert g(D1) <= g(D2)', () => {
    const t = toleranzFuer('I-15').wert;
    pruefeProperty('I-15', konfig.numRuns, () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0.01, max: 1, noNaN: true }), fc.double({ min: 1, max: 3, noNaN: true }),
          (d1, d2, gMin, gMax) => {
            const [klein, gross] = d1 <= d2 ? [d1, d2] : [d2, d1];
            const p = { form: 'linear' as const, gMin, gMax };
            return skalierung(klein, p) <= skalierung(gross, p) + t;
          },
        ),
      );
    });
  });
});

describe('I-22 Strategie-Vertrag ueber ALLE registrierten Strategien (Property)', () => {
  it('jede Strategie liefert ein Ergebnis in [0,1]', () => {
    // Iteriert ueber das Register, nicht ueber eine im Test aufgezaehlte Liste: eine im
    // Erweiterungsszenario hinzukommende Strategie ist ohne Teststaenderung mitgeprueft.
    expect(alleStrategien().length).toBeGreaterThanOrEqual(2);
    pruefeProperty('I-22', konfig.numRuns, () => {
      for (const strategie of alleStrategien()) {
        fc.assert(
          fc.property(
            fc.double({ min: -1e6, max: 1e6, noNaN: true }),
            fc.double({ min: -1e6, max: 1e6, noNaN: true }),
            fc.double({ min: -1e6, max: 1e6, noNaN: true }),
            fc.double({ min: 0.001, max: 1e5, noNaN: true }),
            fc.double({ min: 0.1, max: 5, noNaN: true }),
            (roh, min, max, sigma, c) => {
              fc.pre(min !== max);
              const r = strategie.normalisiere(roh, {
                grenzeMin: min, grenzeMax: max, gewicht: gewicht(0.5),
                strategie: strategie.bezeichner, quelle: 'manuell', quellSchluessel: 'f',
                bezeichnung: 'Testfaktor',
                referenzverteilung: { mittelwert: min, standardabweichung: sigma, kappungSigma: c },
              }, faktorId('f'));
              return r.ok && r.wert.normiert >= 0 && r.wert.normiert <= 1;
            },
          ),
        );
      }
    });
  });
});
