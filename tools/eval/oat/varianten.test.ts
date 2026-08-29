import { describe, expect, it } from 'vitest';
import { ladeBasisRoh, validiere } from '../shared/konfig.ts';
import { baueVarianten } from './varianten.ts';

const varianten = baueVarianten(ladeBasisRoh());

describe('baueVarianten', () => {
  it('markiert jede Variante, die der Ladepfad zurueckweisen wuerde, als unzulaessig', () => {
    for (const v of varianten) {
      if (!validiere(v.konfigRoh).ok) expect(v.status).toBe('unzulaessig');
    }
  });

  it('erhaelt bei D4 die Umpolung vertauschter Grenzen', () => {
    // Der Standardfaktor der Gesamtlage ist umgepolt (min > max). Bleibt das erhalten,
    // bleibt auch die Richtung der Normalisierung erhalten (I-13).
    const umgepolt = varianten.filter((v) => v.dimension === 'D4').some((v) => {
      const roh = v.konfigRoh as { aufwandfaktoren: Record<string, { min: number; max: number }> };
      return Object.values(roh.aufwandfaktoren).some((f) => f.min > f.max);
    });
    expect(umgepolt).toBe(true);
  });
});
