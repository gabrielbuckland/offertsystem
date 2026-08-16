import { describe, expect, it } from 'vitest';
import { normalisiereFaktoren } from '../../src/pipeline/stufe3-normalisierung.js';
import { geschlossenerEingang } from '../helper/projekt.js';
import { faktorId } from '../../src/domain/ids.js';

describe('Stufe 3 — normalisiereFaktoren (eq:normalisierung)', () => {
  it('normalisiert alle konfigurierten Faktoren, sortiert nach FaktorId', () => {
    const r = normalisiereFaktoren(geschlossenerEingang());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ids = r.wert.faktoren.map((f) => f.faktorId);
      expect(ids).toEqual([...ids].sort());
      expect(ids).toHaveLength(4);
      for (const f of r.wert.faktoren) {
        expect(f.normiert).toBeGreaterThanOrEqual(0);
        expect(f.normiert).toBeLessThanOrEqual(1);
      }
    }
  });

  it('kennt keinen faktorspezifischen Zweig — lage_gesamt wird nur ueber Grenzen invertiert (I-13)', () => {
    const r = normalisiereFaktoren(geschlossenerEingang());
    if (r.ok) {
      const lage = r.wert.faktoren.find((f) => f.faktorId === faktorId('lage_gesamt'))!;
      expect(lage.grenzeMin).toBe(1);
      expect(lage.grenzeMax).toBe(0);
      expect(lage.normiert).toBeCloseTo(1 - 0.8, 12);
    }
  });

  it('bricht bei fehlendem Rohwert ab — S-02', () => {
    const e = geschlossenerEingang();
    const ohne = new Map(e.rohfaktoren);
    ohne.delete(faktorId('lage_gesamt'));
    const r = normalisiereFaktoren({ ...e, rohfaktoren: ohne });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('FAKTOR_FEHLT');
      expect(r.fehler.stufe).toBe(3);
    }
  });

  it('nimmt nur einen geschlossenen Eingang entgegen (Reihenfolgebindung 2 -> 4.2a -> 3)', () => {
    const e = geschlossenerEingang();
    expect(e.offeneFaktoren).toEqual([]);
  });

  it('weist den Saettigungsbereich ueber `gekappt` aus (A-13)', () => {
    const e = geschlossenerEingang();
    const hoch = new Map(e.rohfaktoren);
    hoch.set(faktorId('innenausbau_qualitaet'), 99);
    const r = normalisiereFaktoren({ ...e, rohfaktoren: hoch });
    if (r.ok) {
      const f = r.wert.faktoren.find((x) => x.faktorId === faktorId('innenausbau_qualitaet'))!;
      expect(f.gekappt).toBe(true);
      expect(f.normiert).toBe(1);
    }
  });
});
