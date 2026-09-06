import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoWurzel } from '../shared/artefakt.ts';
import { renormalisiere } from './renormalisierung.ts';

const basis = {
  lage_gesamt: 0.40,
  innenausbau_qualitaet: 0.25,
  preissegment: 0.20,
  projektumfang: 0.15,
};

const STUFEN = [-0.2, -0.1, 0.1, 0.2] as const;

describe('renormalisiere', () => {
  it('haelt die Summe 1 bei allen vier Variationsstufen', () => {
    for (const delta of STUFEN) {
      const e = renormalisiere(basis, 'lage_gesamt', delta);
      expect(e.status).toBe('ok');
      const summe = Object.values(e.gewichte!).reduce((a, b) => a + b, 0);
      expect(summe).toBeCloseTo(1, 12);
    }
  });

  it('variiert das Zielgewicht exakt um delta', () => {
    expect(renormalisiere(basis, 'projektumfang', 0.2).gewichte!['projektumfang'])
      .toBeCloseTo(0.18, 12);
  });

  it('erhaelt die Verhaeltnisse der uebrigen Gewichte', () => {
    const g = renormalisiere(basis, 'projektumfang', -0.2).gewichte!;
    expect(g['lage_gesamt']! / g['preissegment']!).toBeCloseTo(0.40 / 0.20, 12);
    expect(g['innenausbau_qualitaet']! / g['preissegment']!).toBeCloseTo(0.25 / 0.20, 12);
  });

  it('markiert einen Lauf als unzulaessig, wenn kein Restgewicht bleibt', () => {
    const e = renormalisiere({ a: 0.9, b: 0.1 }, 'a', 0.2);
    expect(e.status).toBe('unzulaessig');
    expect(e.grund).toContain('Restgewicht');
    expect(e.gewichte).toBeNull();
  });

  it('bleibt innerhalb der Toleranz aus invariants.json', () => {
    // Ueberschreitung erschiene im OAT-Lauf als «unzulaessig» und entwertete D1 still.
    const invarianten = JSON.parse(readFileSync(
      join(repoWurzel(), 'packages', 'core', 'test', 'property', 'invariants.json'), 'utf8'),
    ) as readonly { id: string; wert: number }[];
    // Toleranzfeld heisst in P2s Datei `wert`, nicht `toleranzwert` (E-17).
    const toleranz = invarianten.find((i) => i.id === 'I-12')!.wert;
    for (const id of Object.keys(basis)) {
      for (const delta of STUFEN) {
        const e = renormalisiere(basis, id, delta);
        const summe = Object.values(e.gewichte!).reduce((a, b) => a + b, 0);
        expect(Math.abs(summe - 1)).toBeLessThanOrEqual(toleranz);
      }
    }
  });
});
