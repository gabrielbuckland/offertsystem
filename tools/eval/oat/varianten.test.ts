import { describe, expect, it } from 'vitest';
import { ladeBasisRoh, validiere } from '../shared/konfig.ts';
import { baueVarianten } from './varianten.ts';

const varianten = baueVarianten(ladeBasisRoh());

describe('baueVarianten', () => {
  it('deckt alle sechs Dimensionen ab', () => {
    expect([...new Set(varianten.map((v) => v.dimension))].sort())
      .toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
  });

  it('variiert je Parameter genau die vier Stufen -20/-10/+10/+20', () => {
    const stufenJeParameter = new Map<string, number[]>();
    for (const v of varianten) {
      const schluessel = `${v.dimension}|${v.parameter_id}`;
      stufenJeParameter.set(schluessel,
        [...(stufenJeParameter.get(schluessel) ?? []), v.variation_prozent]);
    }
    for (const [schluessel, stufen] of stufenJeParameter) {
      expect(new Set(stufen), schluessel).toEqual(new Set([-20, -10, 10, 20]));
    }
  });

  it('fuehrt fuer D1 je Faktor eine eigene Parameterkennung', () => {
    const faktoren = new Set(varianten.filter((v) => v.dimension === 'D1')
      .map((v) => v.parameter_id));
    // Seit Konfigversion 1.1.0 fuehren die Firmen-Defaults drei Faktoren (der manuelle
    // Innenausbau-Faktor ist entfallen, config/README.md).
    expect(faktoren.size).toBeGreaterThanOrEqual(3);
    for (const id of faktoren) expect(id.startsWith('w:')).toBe(true);
  });

  it('fuehrt fuer jede Variante den Gewichtsvektor vor und nach der Renormalisierung', () => {
    for (const v of varianten) {
      expect(v.gewichte_vor).not.toBeNull();
      expect(v.gewichte_nach).not.toBeNull();
    }
  });

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
