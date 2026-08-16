import { describe, expect, it } from 'vitest';
import { ladeBasisRoh, validiere } from '../shared/konfig.ts';
import {
  RISIKOINDEX_GEWICHT,
  erweitereUmRisikoindex,
  verletzendeVariante,
} from './konfig-erweiterung.ts';

interface RohFaktoren {
  aufwandfaktoren: Record<string, {
    gewicht: number; quelle: string; strategie: string;
  }>;
}

const basis = ladeBasisRoh() as RohFaktoren;
const erweitert = erweitereUmRisikoindex(ladeBasisRoh()) as RohFaktoren;

describe('erweitereUmRisikoindex', () => {
  it('fuegt genau einen Faktoreintrag hinzu', () => {
    expect(Object.keys(erweitert.aufwandfaktoren))
      .toHaveLength(Object.keys(basis.aufwandfaktoren).length + 1);
    expect(erweitert.aufwandfaktoren['risikoindex']!.quelle).toBe('manuell');
    expect(erweitert.aufwandfaktoren['risikoindex']!.strategie).toBe('minmax');
    expect(erweitert.aufwandfaktoren['risikoindex']!.gewicht).toBe(RISIKOINDEX_GEWICHT);
  });

  it('renormalisiert die bestehenden Gewichte mit dem Faktor 1 - 0.10', () => {
    for (const id of Object.keys(basis.aufwandfaktoren)) {
      expect(erweitert.aufwandfaktoren[id]!.gewicht)
        .toBeCloseTo(basis.aufwandfaktoren[id]!.gewicht * (1 - RISIKOINDEX_GEWICHT), 12);
    }
  });

  it('haelt die Gewichtssumme bei 1', () => {
    const summe = Object.values(erweitert.aufwandfaktoren)
      .reduce((a, f) => a + f.gewicht, 0);
    expect(summe).toBeCloseTo(1, 12);
  });

  it('besteht alle drei Pruefebenen', () => {
    expect(validiere(erweitereUmRisikoindex(ladeBasisRoh())).ok).toBe(true);
  });
});

describe('verletzendeVariante', () => {
  it('nimmt den Faktor ohne Renormalisierung auf: Sigma w = 1.10', () => {
    const v = verletzendeVariante(ladeBasisRoh()) as RohFaktoren;
    const summe = Object.values(v.aufwandfaktoren).reduce((a, f) => a + f.gewicht, 0);
    expect(summe).toBeCloseTo(1.10, 12);
  });

  it('wird mit CFG_WEIGHTS_SUM zurueckgewiesen (I-12)', () => {
    const e = validiere(verletzendeVariante(ladeBasisRoh()));
    expect(e.ok).toBe(false);
    if (e.ok) return;
    expect(e.fehler.map((f) => f.code)).toContain('CFG_WEIGHTS_SUM');
  });
});
