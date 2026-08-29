import { describe, expect, it } from 'vitest';
import { ladeBasis } from './konfig.ts';
import { fuehreAus } from './lauf.ts';
import { ladeSzenarien } from './szenario.ts';

const konfig = ladeBasis();
const szenarien = ladeSzenarien();
const holen = (id: string) => szenarien.find((s) => s.szenario_id === id)!;

describe('fuehreAus', () => {
  it('rechnet S1 durch und liefert Rappenwerte', () => {
    const ergebnis = fuehreAus(holen('S1'), konfig);
    expect(ergebnis.ok).toBe(true);
    expect(Number.isInteger(ergebnis.v_rappen)).toBe(true);
    expect(Number.isInteger(ergebnis.hmin_rappen)).toBe(true);
    expect(ergebnis.d).toBeGreaterThanOrEqual(0);
    expect(ergebnis.d).toBeLessThanOrEqual(1);
  });

  it('liefert bei S5 einen Fehlercode statt eines Ergebnisses (I-24)', () => {
    const ergebnis = fuehreAus(holen('S5'), konfig);
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.fehlercode).not.toBeNull();
    expect(ergebnis.v_rappen).toBeNull();
  });

  it('ist deterministisch (I-14)', () => {
    expect(fuehreAus(holen('S2'), konfig)).toEqual(fuehreAus(holen('S2'), konfig));
  });
});
