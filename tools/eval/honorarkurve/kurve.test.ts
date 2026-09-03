import { describe, expect, it } from 'vitest';
import { ladeBasis } from '../shared/konfig.ts';
import type { Stuetzstelle } from '../degression-margin/honorarkurve.ts';
import { abtastpunkte, baueKurve, darstellbareStuetzstellen } from './kurve.ts';

const stuetz = ladeBasis().honorar.stuetzstellen as readonly Stuetzstelle[];
const punkte = abtastpunkte(stuetz, 8);
const kurve = baueKurve(stuetz, punkte);

describe('abtastpunkte', () => {
  it('enthaelt jede Stuetzstelle mit V > 0 als exakten Punkt', () => {
    for (const s of darstellbareStuetzstellen(stuetz)) expect(punkte).toContain(s.v);
  });

  it('bleibt im definierten Bereich und erzeugt oberhalb der letzten Stuetzstelle nichts', () => {
    const letzte = stuetz[stuetz.length - 1]!.v;
    expect(Math.max(...punkte)).toBe(letzte);
    expect(punkte.every((v) => v > 0 && v <= letzte)).toBe(true);
  });

  it('laesst die Stufe aus, die bei V = 0 beginnt — phi ist dort nicht definiert', () => {
    expect(Math.min(...punkte)).toBe(darstellbareStuetzstellen(stuetz)[0]!.v);
  });

  it('legt Punkte auch in jede Stufe zwischen den Stuetzstellen', () => {
    const grenzen = new Set(stuetz.map((s) => s.v));
    for (let k = 1; k < stuetz.length - 1; k += 1) {
      const innen = punkte.filter((v) => v > stuetz[k]!.v && v < stuetz[k + 1]!.v
        && !grenzen.has(v));
      expect(innen.length).toBeGreaterThan(0);
    }
  });
});

describe('baueKurve', () => {
  it('berechnet den Prozentanteil an einer Stuetzstelle korrekt', () => {
    const s = darstellbareStuetzstellen(stuetz)[0]!;
    const punkt = kurve.find((k) => k.v_rappen === s.v)!;
    expect(punkt.hMin_prozent).toBeCloseTo((s.hMin / s.v) * 100, 12);
    expect(punkt.hMax_prozent).toBeCloseTo((s.hMax / s.v) * 100, 12);
  });

  it('haelt hMax nirgends unter hMin', () => {
    expect(kurve.every((k) => k.hMax_prozent >= k.hMin_prozent)).toBe(true);
  });

  it('verwirft Punkte ausserhalb des definierten Bereichs', () => {
    const letzte = stuetz[stuetz.length - 1]!.v;
    expect(baueKurve(stuetz, [letzte + 1, 0, -1])).toHaveLength(0);
  });
});
