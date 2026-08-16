import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ladeBasis, ladeBasisRoh } from '../shared/konfig.ts';
import { ladeSzenarien } from '../shared/szenario.ts';
import {
  baueZeilen,
  berechneBasis,
  bestimmeWirkpfad,
  hauptlauf,
  istDominant,
  type OatZeile,
} from './main.ts';
import { baueVarianten, type Variante } from './varianten.ts';

describe('istDominant', () => {
  it('gilt ab mehr als 10 Prozent in mindestens einer Ergebnisgroesse', () => {
    expect(istDominant({ v: 2, hmin: 12, hmax: 12 })).toBe(true);
    expect(istDominant({ v: -14, hmin: 0, hmax: 0 })).toBe(true);
    expect(istDominant({ v: 10, hmin: 10, hmax: -10 })).toBe(false);
    expect(istDominant({ v: null, hmin: null, hmax: null })).toBe(false);
  });
});

describe('bestimmeWirkpfad', () => {
  it('unterscheidet die drei Pfade', () => {
    expect(bestimmeWirkpfad({ dV: 0, dH: 0, dD: 0 })).toBe('kein_effekt');
    expect(bestimmeWirkpfad({ dV: 5, dH: 5, dD: 0 })).toBe('nur_ueber_V');
    expect(bestimmeWirkpfad({ dV: 5, dH: 7, dD: 0.01 })).toBe('auch_ueber_D');
  });
});

describe('Basislaeufe und Zeilen', () => {
  const szenarien = ladeSzenarien();
  const konfig = ladeBasis();

  it('haelt je Szenario genau einen Basislauf', () => {
    const basis = berechneBasis(szenarien, konfig);
    expect(basis.size).toBe(szenarien.length);
    expect(basis.get('S1')!.ok).toBe(true);
  });

  it('erzeugt je Variante und Szenario genau eine Zeile', () => {
    const varianten = baueVarianten(ladeBasisRoh());
    const zeilen = baueZeilen(varianten, szenarien, berechneBasis(szenarien, konfig));
    expect(zeilen.length).toBe(varianten.length * szenarien.length);
  });

  it('markiert unzulaessige Varianten, ohne sie zu rechnen', () => {
    const kuenstlich: readonly Variante[] = [{
      dimension: 'D2', parameter_id: 'flaeche.alpha', variation_prozent: 20,
      konfigRoh: {}, gewichte_vor: {}, gewichte_nach: {}, szenarioUmbau: null,
      status: 'unzulaessig', grund: 'CFG_ALPHA_RANGE',
    }];
    for (const z of baueZeilen(kuenstlich, szenarien, berechneBasis(szenarien, konfig))) {
      expect(z.status).toBe('unzulaessig');
      expect(z.neu_V_rappen).toBeNull();
    }
  });
});

describe('Abnahmetest F1 (Spec 06 §7.1)', () => {
  it('erfuellt F1: sechs Dimensionen, vier Stufen, getrennte Messung, JSON und CSV', () => {
    const verzeichnis = hauptlauf();
    const artefakt = JSON.parse(readFileSync(join(verzeichnis, 'oat.json'), 'utf8')) as {
      zeilen: readonly OatZeile[];
    };
    expect(new Set(artefakt.zeilen.map((z) => z.dimension)).size).toBe(6);
    expect(existsSync(join(verzeichnis, 'oat.csv'))).toBe(true);
    for (const z of artefakt.zeilen.filter((z) => z.status === 'ok')) {
      expect(z).toHaveProperty('delta_V_prozent');
      expect(z).toHaveProperty('delta_Hmin_prozent');
      expect(z).toHaveProperty('delta_Hmax_prozent');
    }
    for (const z of artefakt.zeilen.filter((z) => z.dimension === 'D1')) {
      const summe = Object.values(z.gewichte_nach ?? { x: 1 }).reduce((a, b) => a + b, 0);
      expect(summe).toBeCloseTo(1, 9);
    }
  });
});
