import { describe, expect, it } from 'vitest';
import {
  berechneNettoDegression,
  interpoliereHonorarbasis,
  pruefeNettoDegression,
  pruefeStufenDegression,
} from '../../src/config/degression.js';
import { BASIS_KONFIGURATION, baueKonfiguration } from '../konfigurations-bauer.js';

const stuetzstellen = BASIS_KONFIGURATION.honorar.stuetzstellen;

describe('interpoliereHonorarbasis (eq:honorar_mapping)', () => {
  it('interpoliert linear innerhalb einer Stufe', () => {
    // V = 20 Mio. CHF = 2_000_000_000 Rappen, Stufe [10, 25) Mio.
    // hMax = 260_000 + (10/15) * 240_000 = 420_000 CHF
    expect(interpoliereHonorarbasis(stuetzstellen, 2000000000, 'hMax')).toBeCloseTo(42000000, 6);
    expect(interpoliereHonorarbasis(stuetzstellen, 2000000000, 'hMin')).toBeCloseTo(31500000, 6);
  });

  it('trifft die Stuetzstellen exakt', () => {
    expect(interpoliereHonorarbasis(stuetzstellen, 0, 'hMax')).toBe(4000000);
    expect(interpoliereHonorarbasis(stuetzstellen, 20000000000, 'hMax')).toBe(200000000);
  });

  it('ist oberhalb der hoechsten Stuetzstelle nicht definiert — keine Extrapolation', () => {
    expect(interpoliereHonorarbasis(stuetzstellen, 25000000000, 'hMax')).toBeUndefined();
  });
});

describe('pruefeStufenDegression (eq:degression_stufe, I-19)', () => {
  it('nimmt die Standardstuetzstellen an', () => {
    expect(pruefeStufenDegression(stuetzstellen)).toEqual([]);
  });

  it('meldet eine Stufe, in der der Grenzsatz den Durchschnittssatz erreicht', () => {
    const verletzend = baueKonfiguration((k) => { k.honorar.stuetzstellen[1]!.hMax = 5000000; });
    const befunde = pruefeStufenDegression(verletzend.honorar.stuetzstellen);
    expect(befunde.map((f) => f.code)).toContain('CFG_TIER_DEGRESSION');
    const treffer = befunde.find((f) => f.code === 'CFG_TIER_DEGRESSION');
    expect(treffer?.parameter['stufe']).toBe(1);
    expect(treffer?.parameter['kurve']).toBe('hMax');
  });

  it('prueft beide Randkurven getrennt', () => {
    const verletzend = baueKonfiguration((k) => { k.honorar.stuetzstellen[1]!.hMin = 3750000; });
    const befunde = pruefeStufenDegression(verletzend.honorar.stuetzstellen);
    expect(befunde.some((f) => f.parameter['kurve'] === 'hMin')).toBe(true);
    expect(befunde.some((f) => f.parameter['kurve'] === 'hMax')).toBe(false);
  });
});

describe('berechneNettoDegression (eq:netto_degression, I-18)', () => {
  it('weist fuer die Standardkonfiguration die kleinste Marge aus, ohne Reichweitengrenze', () => {
    const befund = berechneNettoDegression(BASIS_KONFIGURATION);
    expect(befund).toBeDefined();
    if (befund === undefined) return;
    expect(befund.lambda).toBeCloseTo(9, 10);
    expect(befund.rhoMax).toBeCloseTo(1.052941, 5);
    expect(befund.schwelle).toBeCloseTo(0.949721, 5);
    expect(befund.kleinsteMarge).toBeCloseTo(0.421, 2);
    expect(befund.verletzendesV).toBeUndefined();
    expect(pruefeNettoDegression(BASIS_KONFIGURATION)).toEqual([]);
  });

  it('entfaellt, wenn kein Faktor den Quellschluessel einheitenzahl fuehrt', () => {
    // Zugriff ueber den FAKTORschluessel `projektumfang` — der bleibt (PE-03).
    const ohne = baueKonfiguration((k) => {
      delete k.aufwandfaktoren['projektumfang'];
      k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.55;
    });
    expect(berechneNettoDegression(ohne)).toBeUndefined();
    expect(pruefeNettoDegression(ohne)).toEqual([]);
  });

  it('meldet eine Verletzung bei zu starkem Wirkpfad des Projektumfangs', () => {
    const verletzend = baueKonfiguration((k) => {
      k.aufwandfaktoren['projektumfang']!.gewicht = 0.6;
      k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.2;
      k.aufwandfaktoren['innenausbau_qualitaet']!.gewicht = 0.1;
      k.aufwandfaktoren['preissegment']!.gewicht = 0.1;
      k.honorar.skalierung.gMin = 0.5;
      k.honorar.skalierung.gMax = 2.5;
    });
    const befunde = pruefeNettoDegression(verletzend);
    expect(befunde.map((f) => f.code)).toContain('CFG_NET_DEGRESSION');
    expect(berechneNettoDegression(verletzend)?.verletzendesV).toBeDefined();
  });

  it('vergroessert die Marge nach einer Renormalisierung um einen weiteren Faktor', () => {
    const erweitert = baueKonfiguration((k) => {
      k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.36;
      k.aufwandfaktoren['innenausbau_qualitaet']!.gewicht = 0.225;
      k.aufwandfaktoren['preissegment']!.gewicht = 0.18;
      k.aufwandfaktoren['projektumfang']!.gewicht = 0.135;
      k.aufwandfaktoren['risikoindex'] = {
        bezeichnung: 'Risikoindex (Marktvolatilitaet der Region)',
        quelle: 'manuell',
        quellSchluessel: 'risikoindex',
        strategie: 'minmax',
        min: 1,
        max: 6,
        gewicht: 0.1,
      };
    });
    const vorher = berechneNettoDegression(BASIS_KONFIGURATION);
    const nachher = berechneNettoDegression(erweitert);
    expect(nachher!.kleinsteMarge).toBeGreaterThan(vorher!.kleinsteMarge);
  });
});
