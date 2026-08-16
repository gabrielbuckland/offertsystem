import { describe, expect, it } from 'vitest';
import { gewichteteFlaeche } from '../../src/modell/flaeche.js';
import { quadratmeter, quadratmeterAbNull } from '../../src/domain/geld.js';

describe('gewichteteFlaeche — eq:flaeche', () => {
  it('bildet A = A_innen + alpha * A_aussen', () => {
    expect(gewichteteFlaeche(quadratmeter(92.5), quadratmeterAbNull(12), 0.5)).toBeCloseTo(98.5, 12);
    expect(gewichteteFlaeche(quadratmeter(100), quadratmeterAbNull(20), 0)).toBe(100);
    expect(gewichteteFlaeche(quadratmeter(100), quadratmeterAbNull(20), 1)).toBe(120);
    expect(gewichteteFlaeche(quadratmeter(100), quadratmeterAbNull(20), 0.25)).toBe(105);
  });

  it('weist alpha ausserhalb [0,1] als Defekt zurueck (I-04)', () => {
    expect(() => gewichteteFlaeche(quadratmeter(100), quadratmeterAbNull(0), 1.1)).toThrow(/alpha/);
    expect(() => gewichteteFlaeche(quadratmeter(100), quadratmeterAbNull(0), -0.1)).toThrow(/alpha/);
  });

  it('laesst Parkplaetze ausser Betracht — sie sind kein Argument (Brief §8)', () => {
    expect(gewichteteFlaeche.length).toBe(3);
  });
});
