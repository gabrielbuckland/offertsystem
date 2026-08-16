import { describe, expect, it } from 'vitest';
import { quadratmeter, rappen, rundeAufRappen, score, zuFranken } from '../../src/domain/geld.js';

describe('rundeAufRappen — kaufmaennisch, symmetrisch (Spec 03 §5.5, E-10)', () => {
  it('rundet halbe Betraege vom Nullpunkt weg', () => {
    expect(rundeAufRappen(0.5)).toBe(1);
    expect(rundeAufRappen(-0.5)).toBe(-1);
    expect(rundeAufRappen(1.5)).toBe(2);
    expect(rundeAufRappen(-1.5)).toBe(-2);
    expect(rundeAufRappen(2.4)).toBe(2);
    expect(rundeAufRappen(-2.4)).toBe(-2);
  });

  it('ist symmetrisch: runde(-x) === -runde(x)', () => {
    for (const x of [0.5, 1.5, 2.5, 3.14159, 85_000_007.5]) {
      // Der Markentyp wird vor der Negation abgelegt: eine unaere Negation auf
      // `Rappen` waere eine Rechenoperation auf einem Markentyp und wird von
      // `no-unsafe-unary-minus` zu Recht beanstandet.
      const positiv: number = rundeAufRappen(x);
      expect(rundeAufRappen(-x)).toBe(-positiv);
    }
  });

  it('ist auf Ganzzahlen die Identitaet — Voraussetzung von I-05', () => {
    expect(rundeAufRappen(85_000_000)).toBe(85_000_000);
  });
});

describe('rappen', () => {
  it('weist nichtganzzahlige Werte zurueck', () => {
    expect(() => rappen(1.5)).toThrow(/ganzzahlig/);
    expect(() => rappen(Number.NaN)).toThrow(/ganzzahlig/);
    expect(() => rappen(Number.POSITIVE_INFINITY)).toThrow(/ganzzahlig/);
  });
  it('nimmt Ganzzahlen an', () => {
    expect(rappen(-100)).toBe(-100);
  });
});

describe('zuFranken — einzige Ausgangstuer der Preiskette', () => {
  it('teilt durch hundert', () => {
    expect(zuFranken(rappen(85_000_000))).toBe(850_000);
  });
});

describe('Skalengroessen', () => {
  it('weist Quadratmeter <= 0 und Scores ausserhalb [0,1] zurueck', () => {
    expect(() => quadratmeter(0)).toThrow(/groesser als null/);
    expect(() => score(1.0001)).toThrow(/\[0, 1\]/);
    expect(score(0)).toBe(0);
    expect(score(1)).toBe(1);
  });
});
