import { describe, expect, it } from 'vitest';
import {
  kritischerParameter,
  loeseSpanne,
  loeseStuetzstellen,
  loeseUmfangsgewicht,
  type Aufloesung,
} from './aufloesung.ts';

describe('loeseSpanne', () => {
  it('liefert genau die Spanne, bei der L = R gilt', () => {
    const gMin = 0.85, d1 = 0.0, d2 = 0.15, r = 1.02;
    const e = loeseSpanne({ gMin, spanne: 0.30, d1, d2, r });
    expect(e.erreichbar).toBe(true);
    const l = (gMin + d2 * e.zielwert!) / (gMin + d1 * e.zielwert!);
    expect(l).toBeCloseTo(r, 10);
  });

  it('meldet unerreichbar, wenn der Nenner nicht positiv ist', () => {
    const e = loeseSpanne({ gMin: 0.85, spanne: 0.30, d1: 0.10, d2: 0.12, r: 2.0 });
    expect(e.erreichbar).toBe(false);
    expect(e.grund).toContain('unerreichbar');
  });
});

describe('loeseUmfangsgewicht', () => {
  it('loest das Umfangsgewicht auf und respektiert die Gewichtssumme', () => {
    const e = loeseUmfangsgewicht({ gMin: 0.85, spanne: 0.30, w: 0.15, x1: 0, x2: 1, r: 1.02 });
    expect(e.erreichbar).toBe(true);
    const l = (0.85 + e.zielwert! * 1 * 0.30) / (0.85 + e.zielwert! * 0 * 0.30);
    expect(l).toBeCloseTo(1.02, 10);

    const zuGross = loeseUmfangsgewicht({
      gMin: 0.85, spanne: 0.01, w: 0.15, x1: 0, x2: 1, r: 1.5,
    });
    expect(zuGross.erreichbar).toBe(false);
    expect(zuGross.grund).toContain('Gewichtssumme');
  });
});

describe('loeseStuetzstellen', () => {
  it('loest die Stuetzstellenfamilie auf oder meldet sie als unerreichbar', () => {
    const e = loeseStuetzstellen({
      h0: 4_000_000, a1: 1_000_000, a2: 6_000_000, lambda: 9, l: 1.05,
    });
    if (e.erreichbar) {
      const u = e.zielwert!;
      const r = 9 * (4_000_000 + u * 1_000_000) / (4_000_000 + u * 6_000_000);
      expect(r).toBeCloseTo(1.05, 8);
    } else {
      expect(e.grund).toContain('unerreichbar');
    }
  });
});

describe('kritischerParameter', () => {
  const bau = (parameter: string, variation: number | null, erreichbar: boolean): Aufloesung => ({
    parameter, istwert: 1, zielwert: variation, relative_variation: variation,
    erreichbar, unerreichbar_im_variationsbereich: false, grund: null,
  });

  it('waehlt den Parameter mit der kleinsten noetigen Variation und ignoriert Unerreichbares', () => {
    expect(kritischerParameter([
      bau('a', 0.8, true), bau('b', 0.3, true), bau('c', 0.01, false),
    ])).toBe('b');
  });

  it('liefert null, wenn keiner erreichbar ist', () => {
    expect(kritischerParameter([bau('a', null, false)])).toBeNull();
  });
});
