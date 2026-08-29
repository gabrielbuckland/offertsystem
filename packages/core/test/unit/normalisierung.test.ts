import { describe, expect, it } from 'vitest';
import { alleStrategien, loeseStrategieAuf } from '../../src/normalization/registry.js';
import { gewicht } from '../../src/domain/geld.js';
import { faktorId } from '../../src/domain/ids.js';
import type { FaktorParameter } from '../../src/config/typen.js';

const p = (u: Partial<FaktorParameter> = {}): FaktorParameter => ({
  grenzeMin: 0, grenzeMax: 10, gewicht: gewicht(0.5), strategie: 'min-max',
  quelle: 'manuell', quellSchluessel: 'f', bezeichnung: 'Testfaktor', ...u,
});

describe('Min-Max — eq:normalisierung mit aeusserer Kappung', () => {
  const s = loeseStrategieAuf('min-max');
  it('bildet (x - min) / (max - min)', () => {
    const r = s.normalisiere(2.5, p(), faktorId('f'));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.wert.normiert).toBeCloseTo(0.25, 12); expect(r.wert.gekappt).toBe(false); }
  });

  it('kappt aussen und markiert die Kappung (I-11)', () => {
    const unten = s.normalisiere(-100, p(), faktorId('f'));
    const oben = s.normalisiere(1000, p(), faktorId('f'));
    if (unten.ok && oben.ok) {
      expect(unten.wert.normiert).toBe(0);
      expect(oben.wert.normiert).toBe(1);
      expect(unten.wert.gekappt).toBe(true);
      expect(oben.wert.gekappt).toBe(true);
    }
  });

  it('poled allein ueber vertauschte Grenzen um: x_min = 1, x_max = 0 ergibt 1 - x (Brief §4)', () => {
    const r = s.normalisiere(0.8, p({ grenzeMin: 1, grenzeMax: 0 }), faktorId('lage_gesamt'));
    if (r.ok) expect(r.wert.normiert).toBeCloseTo(0.2, 12);
  });

  it('sortiert oder normalisiert die Grenzen NICHT — das hoebe die Umpolung auf', () => {
    const r = s.normalisiere(0.8, p({ grenzeMin: 1, grenzeMax: 0 }), faktorId('lage_gesamt'));
    if (r.ok) { expect(r.wert.grenzeMin).toBe(1); expect(r.wert.grenzeMax).toBe(0); }
  });

  it('meldet S-01 bei identischen Grenzen und setzt keinen Ersatzwert', () => {
    const r = s.normalisiere(5, p({ grenzeMin: 3, grenzeMax: 3 }), faktorId('f'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('NORM_GRENZEN_IDENTISCH');
      expect(r.fehler.stufe).toBe(3);
      expect(r.fehler.parameter).toMatchObject(
        { faktorId: 'f', bezeichnung: 'Testfaktor', wert: 3 });
    }
  });
});

describe('Z-Score mit nachgelagerter Kappung (Brief §5.5)', () => {
  const s = loeseStrategieAuf('z-score');
  const zp = p({ strategie: 'z-score',
    referenzverteilung: { mittelwert: 100, standardabweichung: 20, kappungSigma: 2 } });

  it('bildet (z + c) / (2c) mit Kappung', () => {
    const mitte = s.normalisiere(100, zp, faktorId('f'));
    const oben = s.normalisiere(140, zp, faktorId('f'));
    const weit = s.normalisiere(1000, zp, faktorId('f'));
    if (mitte.ok && oben.ok && weit.ok) {
      expect(mitte.wert.normiert).toBeCloseTo(0.5, 12);
      expect(oben.wert.normiert).toBeCloseTo(1, 12);
      expect(weit.wert.normiert).toBe(1);
      expect(weit.wert.gekappt).toBe(true);
    }
  });

  it('behandelt sigma = 0 als S-01 — Division durch null', () => {
    const r = s.normalisiere(100, p({ strategie: 'z-score',
      referenzverteilung: { mittelwert: 100, standardabweichung: 0, kappungSigma: 2 } }),
      faktorId('f'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler.code).toBe('NORM_GRENZEN_IDENTISCH');
  });
});

describe('loeseStrategieAuf ist total (S-07)', () => {
  it('gibt die Strategie direkt zurueck, nicht in Result verpackt', () => {
    expect(loeseStrategieAuf('min-max').bezeichner).toBe('min-max');
    expect(loeseStrategieAuf('z-score').bezeichner).toBe('z-score');
  });
  it('macht das Register fuer I-22 aufzaehlbar', () => {
    expect(alleStrategien().map((s) => s.bezeichner).sort())
      .toEqual(['min-max', 'wurzel-min-max', 'z-score']);
  });
});
