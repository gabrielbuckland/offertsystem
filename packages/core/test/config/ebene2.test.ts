import { describe, expect, it } from 'vitest';
import { pruefeEbene2 } from '../../src/config/ebene2.js';
import { BASIS_KONFIGURATION, baueKonfiguration } from '../konfigurations-bauer.js';

const codes = (konfiguration: Parameters<typeof pruefeEbene2>[0]): string[] =>
  pruefeEbene2(konfiguration).map((f) => f.code);

describe('Ebene 2 — lokale Wertebereiche', () => {
  it('nimmt die Basiskonfiguration ohne Befund an', () => {
    expect(pruefeEbene2(BASIS_KONFIGURATION)).toEqual([]);
  });

  it('meldet alpha ausserhalb [0,1]', () => {
    expect(codes(baueKonfiguration((k) => { k.flaeche.alpha = 1.4; }))).toContain('CFG_ALPHA_RANGE');
  });

  it('meldet eine Untergrenze der Zu-/Abschlaege von hoechstens -1', () => {
    expect(codes(baueKonfiguration((k) => { k.preisanpassung.zMin = -1; })))
      .toContain('CFG_ADJUSTMENT_BOUNDS');
  });

  it('meldet eine Mindestlaenge der Begruendung unter 1', () => {
    expect(codes(baueKonfiguration((k) => { k.preisanpassung.begruendungMinLaenge = 0; })))
      .toContain('CFG_REASON_MIN_LENGTH');
  });

  it('meldet ein negatives Gewicht mit Faktorbezug', () => {
    const gefunden = pruefeEbene2(baueKonfiguration((k) => {
      k.aufwandfaktoren['preissegment']!.gewicht = -0.05;
    }));
    const treffer = gefunden.find((f) => f.code === 'CFG_WEIGHT_RANGE');
    expect(treffer?.pfad).toBe('aufwandfaktoren.preissegment.gewicht');
    expect(treffer?.parameter['wert']).toBe(-0.05);
  });

  it('meldet identische Normalisierungsgrenzen', () => {
    expect(codes(baueKonfiguration((k) => {
      k.aufwandfaktoren['innenausbau_qualitaet']!.max = 1;
    }))).toContain('CFG_NORM_BOUNDS');
  });

  it('akzeptiert vertauschte Grenzen als dokumentierte Invertierung', () => {
    expect(pruefeEbene2(BASIS_KONFIGURATION).filter((f) => f.code === 'CFG_NORM_BOUNDS')).toEqual([]);
    expect(BASIS_KONFIGURATION.aufwandfaktoren['lage_gesamt']!.min)
      .toBeGreaterThan(BASIS_KONFIGURATION.aufwandfaktoren['lage_gesamt']!.max);
  });

  it('meldet nicht ganzzahlige Rappenbetraege der Stuetzstellen', () => {
    expect(codes(baueKonfiguration((k) => { k.honorar.stuetzstellen[2]!.hMax = 26000000.5; })))
      .toContain('CFG_TIER_VALUE_RANGE');
  });

  it('meldet einen unzulaessigen Bildbereich von g', () => {
    expect(codes(baueKonfiguration((k) => { k.honorar.skalierung.gMin = 0; })))
      .toContain('CFG_G_RANGE');
    expect(codes(baueKonfiguration((k) => { k.honorar.skalierung.gMax = 0.9; })))
      .toContain('CFG_G_RANGE');
  });

  it('meldet unzulaessige API-Parameter mit Bedingung', () => {
    const gefunden = pruefeEbene2(baueKonfiguration((k) => { k.api.retry.maxVersuche = 0; }));
    const treffer = gefunden.find((f) => f.code === 'CFG_API_PARAM');
    expect(treffer?.pfad).toBe('api.retry.maxVersuche');
    expect(treffer?.parameter['bedingung']).toBe('Ganzzahl >= 1');
  });

  it('meldet eine Token-Sicherheitsmarge, die die Gueltigkeit erreicht', () => {
    const gefunden = pruefeEbene2(baueKonfiguration((k) => {
      k.api.tokenSicherheitsmargeMin = k.api.tokenGueltigkeitMin;
    }));
    const treffer = gefunden.find((f) => f.pfad === 'api.tokenSicherheitsmargeMin');
    expect(treffer?.code).toBe('CFG_API_PARAM');
    expect(treffer?.parameter['bedingung']).toBe('0 <= marge < tokenGueltigkeitMin');
  });

  it('meldet eine negative Token-Sicherheitsmarge, nimmt aber 0 an', () => {
    expect(codes(baueKonfiguration((k) => { k.api.tokenSicherheitsmargeMin = -1; })))
      .toContain('CFG_API_PARAM');
    expect(pruefeEbene2(baueKonfiguration((k) => { k.api.tokenSicherheitsmargeMin = 0; })))
      .toEqual([]);
  });
});
