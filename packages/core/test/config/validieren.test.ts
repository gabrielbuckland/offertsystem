import { describe, expect, it } from 'vitest';
import { validiereKonfiguration } from '../../src/config/validieren.js';
import { BASIS_KONFIGURATION, baueKonfiguration } from '../konfigurations-bauer.js';

describe('validiereKonfiguration', () => {
  it('nimmt die Basiskonfiguration an', () => {
    const ergebnis = validiereKonfiguration(BASIS_KONFIGURATION);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.meta.schemaVersion).toBe(1);
  });

  it('bildet fehlende Pflichtfelder auf CFG_SCHEMA_MISSING ab', () => {
    const ohne = structuredClone(BASIS_KONFIGURATION) as Record<string, unknown>;
    delete ohne['honorar'];
    const ergebnis = validiereKonfiguration(ohne);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]).toMatchObject({ code: 'CFG_SCHEMA_MISSING', ebene: 1, pfad: 'honorar' });
  });

  it('bildet unbekannte Schluessel auf CFG_SCHEMA_UNKNOWN_KEY ab', () => {
    const ergebnis = validiereKonfiguration({ ...structuredClone(BASIS_KONFIGURATION), tippfehler: 1 });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_SCHEMA_UNKNOWN_KEY');
  });

  it('bildet eine falsche Schemaversion auf CFG_SCHEMA_VERSION ab', () => {
    const ergebnis = validiereKonfiguration(baueKonfiguration((k) => {
      (k.meta as { schemaVersion: number }).schemaVersion = 2;
    }));
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_VERSION');
  });

  it('bildet eine unbekannte Strategie auf CFG_STRATEGY_UNKNOWN ab', () => {
    const fremd = structuredClone(BASIS_KONFIGURATION);
    (fremd.aufwandfaktoren['lage_gesamt'] as unknown as Record<string, unknown>)['strategie'] = 'robust';
    const ergebnis = validiereKonfiguration(fremd);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_STRATEGY_UNKNOWN');
  });

  it('meldet Ebene 3 erst, wenn Ebene 2 leer ist', () => {
    const doppelt = baueKonfiguration((k) => {
      k.flaeche.alpha = 1.4;                       // Ebene 2
      k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.9; // Ebene 3 (Summe != 1)
    });
    const ergebnis = validiereKonfiguration(doppelt);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toEqual(['CFG_ALPHA_RANGE']);
  });

  it('nimmt ganz oder gar nicht an — kein Teilergebnis bei Ebene-3-Verletzung', () => {
    const ergebnis = validiereKonfiguration(baueKonfiguration((k) => {
      k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.34;
    }));
    expect(ergebnis.ok).toBe(false);
    expect(Object.hasOwn(ergebnis, 'wert')).toBe(false);
  });
});
