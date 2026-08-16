import { describe, expect, it } from 'vitest';
import { prozentFuerArtefakt, relativeAenderungProzent, sichereDivision } from './prozent.ts';

describe('relativeAenderungProzent', () => {
  it('liefert die relative Aenderung in Prozentpunkten', () => {
    expect(relativeAenderungProzent(100, 110)).toBeCloseTo(10, 10);
    expect(relativeAenderungProzent(100, 80)).toBeCloseTo(-20, 10);
  });

  it('liefert 0, wenn Basis und neuer Wert identisch sind', () => {
    expect(relativeAenderungProzent(0, 0)).toBe(0);
  });

  it('liefert null, wenn die Basis 0 und der neue Wert ungleich 0 ist', () => {
    expect(relativeAenderungProzent(0, 5)).toBeNull();
  });
});

describe('sichereDivision', () => {
  it('liefert null statt Infinity', () => {
    expect(sichereDivision(1, 0)).toBeNull();
    expect(sichereDivision(6, 3)).toBe(2);
  });
});

describe('prozentFuerArtefakt', () => {
  it('rundet auf vier Nachkommastellen und reicht null durch', () => {
    expect(prozentFuerArtefakt(1.234567)).toBe(1.2346);
    expect(prozentFuerArtefakt(null)).toBeNull();
  });
});
