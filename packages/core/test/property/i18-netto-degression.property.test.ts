import fc from 'fast-check';
import { describe, it } from 'vitest';
import { berechne } from '../../src/pipeline/berechne.js';
import { toleranzFuer } from '../../src/config/toleranzen.js';
import { projektpaarGleicherEinheitenpreis } from './generatoren.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

describe('I-18 Netto-Degression (Property, eq:netto_degression)', () => {
  it('der relative Honorarsatz steigt mit der Einheitenzahl nicht', () => {
    const gToleranz = toleranzFuer('I-18').wert;
    pruefeProperty('I-18', konfig.numRuns, () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 40 }), fc.integer({ min: 1, max: 40 }),
          (m1, delta) => {
            const { klein, gross } = projektpaarGleicherEinheitenpreis(m1, m1 + delta);
            const a = berechne(klein);
            const b = berechne(gross);
            if (!a.ok || !b.ok) return true; // ausserhalb der Stufenliste: kein Gegenbeispiel
            const v1 = a.wert.verkaufssumme.verkaufssumme;
            const v2 = b.wert.verkaufssumme.verkaufssumme;
            // Kreuzmultiplikation auf ganzzahligen Rappen — exakter Ordnungsvergleich.
            const min = b.wert.honorar.honorarMin * v1 <= a.wert.honorar.honorarMin * v2;
            const max = b.wert.honorar.honorarMax * v1 <= a.wert.honorar.honorarMax * v2;
            const gVerhaeltnis = b.wert.honorar.skalierung / a.wert.honorar.skalierung;
            const rechteSeite = (v2 / v1) * (a.wert.honorar.basisMin / b.wert.honorar.basisMin);
            return min && max && gVerhaeltnis <= rechteSeite + gToleranz;
          },
        ),
      );
    });
  });
});
