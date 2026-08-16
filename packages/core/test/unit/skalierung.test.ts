import { describe, expect, it } from 'vitest';
import { skalierung } from '../../src/modell/skalierung.js';
import { standardKonfiguration } from '../helper/projekt.js';

const k = standardKonfiguration();

describe('g(D) — Skalierungsfunktion', () => {
  it('ist linear, monoton steigend und bettet die 1 ein (I-15, I-16)', () => {
    const p = k.honorar.skalierung; // gMin 0.85, gMax 1.15
    expect(skalierung(0, p)).toBeCloseTo(0.85, 12);
    expect(skalierung(0.5, p)).toBeCloseTo(1.0, 12);
    expect(skalierung(1, p)).toBeCloseTo(1.15, 12);
    expect(skalierung(0.3, p)).toBeLessThan(skalierung(0.7, p));
  });
  it('weist D ausserhalb [0,1] als Defekt zurueck', () => {
    expect(() => skalierung(1.5, k.honorar.skalierung)).toThrow(/D/);
  });
});
