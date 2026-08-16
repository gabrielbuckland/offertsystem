import { describe, expect, it } from 'vitest';
import { faktorId } from '../../src/domain/ids.js';
import { standardKonfiguration } from '../helper/projekt.js';

describe('Konfiguration (konsumiert aus P1)', () => {
  it('fuehrt die vier Standardfaktoren mit Gewichtssumme 1 (I-12)', () => {
    const k = standardKonfiguration();
    const summe = [...k.faktoren.values()].reduce((s, f) => s + f.gewicht, 0);
    expect(summe).toBeCloseTo(1, 12);
    expect([...k.faktoren.keys()].sort()).toEqual(
      ['innenausbau_qualitaet', 'lage_gesamt', 'preissegment', 'projektumfang']);
  });

  it('fuehrt die Polung von lage_gesamt allein ueber vertauschte Grenzen (I-13, Brief §4)', () => {
    const f = standardKonfiguration().faktoren.get(
      [...standardKonfiguration().faktoren.keys()].find((k) => k === 'lage_gesamt')!)!;
    expect(f.grenzeMin).toBe(1);
    expect(f.grenzeMax).toBe(0);
  });

  it('fuehrt die Preissegmentgrenzen in Rappen je Quadratmeter (E-07)', () => {
    const f = [...standardKonfiguration().faktoren.entries()]
      .find(([k]) => k === 'preissegment')![1];
    expect(f.grenzeMin).toBe(600_000);
    expect(f.grenzeMax).toBe(1_800_000);
  });

  it('schliesst die Stuetzstellenliste bei 200 Mio. CHF ab (E-04)', () => {
    const s = standardKonfiguration().honorar.stuetzstellen;
    expect(s).toHaveLength(7);
    expect(s[0]!.v).toBe(0);
    expect(s.at(-1)!.v).toBe(20_000_000_000);
    for (let i = 1; i < s.length; i += 1) expect(s[i]!.v).toBeGreaterThan(s[i - 1]!.v);
  });

  it('traegt die ordinale Skala manuell erfasster Faktoren rein deskriptiv (E-24, PE-05)', () => {
    const f = standardKonfiguration().faktoren.get(faktorId('innenausbau_qualitaet'))!;
    expect(f.quelle).toBe('manuell');
    expect(f.skala?.form).toBe('ordinal');
    expect(f.skala?.stufen.map((s) => s.wert)).toEqual([1, 2, 3, 4, 5]);
    expect(f.skala?.stufen.every((s) => s.bezeichnung.length > 0)).toBe(true);
  });

  it('haelt I-16 fuer g: 0 < gMin <= 1 <= gMax', () => {
    const g = standardKonfiguration().honorar.skalierung;
    expect(g.gMin).toBeGreaterThan(0);
    expect(g.gMin).toBeLessThanOrEqual(1);
    expect(g.gMax).toBeGreaterThanOrEqual(1);
  });
});
