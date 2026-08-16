import { describe, expect, it } from 'vitest';
import { parseKonfiguration } from '../../src/config/abbildung.js';
// Objektbauer aus P1 (packages/core/test/konfigurations-bauer.ts) — eine Quelle fuer
// die Standardkonfiguration, kein zweiter Fixture-Satz.
import { BASIS_KONFIGURATION, baueKonfiguration } from '../konfigurations-bauer.js';

describe('parseKonfiguration (PE-01) — Rohkonfiguration auf Kerntyp', () => {
  it('bildet den Faktor-Record auf eine ReadonlyMap ab', () => {
    const r = parseKonfiguration(BASIS_KONFIGURATION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.wert.kern.faktoren).toBeInstanceOf(Map);
    expect([...r.wert.kern.faktoren.keys()].sort()).toEqual(
      Object.keys(BASIS_KONFIGURATION.aufwandfaktoren).sort());
  });

  it('benennt min/max in grenzeMin/grenzeMax um und erhaelt die Werte', () => {
    const r = parseKonfiguration(BASIS_KONFIGURATION);
    if (!r.ok) throw new Error('unerwarteter Fehlschlag');
    for (const [id, roh] of Object.entries(BASIS_KONFIGURATION.aufwandfaktoren)) {
      const f = r.wert.kern.faktoren.get(id as never)!;
      expect(f.grenzeMin).toBe(roh.min);
      expect(f.grenzeMax).toBe(roh.max);
    }
  });

  it('uebersetzt die Strategiebezeichner in die Kernschreibweise (PE-02)', () => {
    const roh = baueKonfiguration((k) => {
      k.aufwandfaktoren['lage_gesamt']!.strategie = 'minmax';
      k.aufwandfaktoren['preissegment']!.strategie = 'zscore';
      k.aufwandfaktoren['preissegment']!.referenzverteilung =
        { mittelwert: 1_200_000, standardabweichung: 200_000, kappungSigma: 3 };
    });
    const r = parseKonfiguration(roh);
    if (!r.ok) throw new Error('unerwarteter Fehlschlag');
    expect(r.wert.kern.faktoren.get('lage_gesamt' as never)!.strategie).toBe('min-max');
    expect(r.wert.kern.faktoren.get('preissegment' as never)!.strategie).toBe('z-score');
  });

  it('uebersetzt jede Schreibweise der Roh-Union — die Abbildung ist total', () => {
    for (const roh of ['minmax', 'zscore'] as const) {
      const k = baueKonfiguration((x) => {
        x.aufwandfaktoren['lage_gesamt']!.strategie = roh;
        if (roh === 'zscore') {
          x.aufwandfaktoren['lage_gesamt']!.referenzverteilung =
            { mittelwert: 0.5, standardabweichung: 0.2, kappungSigma: 3 };
        }
      });
      const r = parseKonfiguration(k);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(['min-max', 'z-score'])
        .toContain(r.wert.kern.faktoren.get('lage_gesamt' as never)!.strategie);
    }
  });

  it('reicht die geprueften Rohdaten mit zurueck, inklusive api-Block (PE-17)', () => {
    const r = parseKonfiguration(BASIS_KONFIGURATION);
    if (!r.ok) throw new Error('unerwarteter Fehlschlag');
    expect(r.wert.roh.api.baseUrl).toBe(BASIS_KONFIGURATION.api.baseUrl);
    expect(r.wert.roh.dossierDefaults).toEqual(BASIS_KONFIGURATION.dossierDefaults);
    expect(r.wert.roh.aufwandfaktoren).toEqual(BASIS_KONFIGURATION.aufwandfaktoren);
  });

  it('nimmt api und dossierDefaults NICHT in den Kerntyp auf', () => {
    const r = parseKonfiguration(BASIS_KONFIGURATION);
    if (!r.ok) throw new Error('unerwarteter Fehlschlag');
    expect(Object.keys(r.wert.kern).sort()).toEqual(
      ['anpassungsVorlagen', 'faktoren', 'flaeche', 'honorar', 'meta', 'preisanpassung']);
  });

  it('reicht die deskriptive Skala unveraendert durch (PE-05)', () => {
    const roh = baueKonfiguration((k) => {
      k.aufwandfaktoren['innenausbau_qualitaet']!.skala = {
        form: 'ordinal',
        stufen: [{ wert: 1, bezeichnung: 'einfach' }, { wert: 5, bezeichnung: 'gehoben' }],
      };
    });
    const r = parseKonfiguration(roh);
    if (!r.ok) throw new Error('unerwarteter Fehlschlag');
    expect(r.wert.kern.faktoren.get('innenausbau_qualitaet' as never)!.skala)
      .toEqual({ form: 'ordinal',
        stufen: [{ wert: 1, bezeichnung: 'einfach' }, { wert: 5, bezeichnung: 'gehoben' }] });
  });

  it('fuellt die Map in Codepoint-Ordnung, unabhaengig von der JSON-Reihenfolge (I-14)', () => {
    const gedreht = structuredClone(BASIS_KONFIGURATION);
    gedreht.aufwandfaktoren = Object.fromEntries(
      Object.entries(gedreht.aufwandfaktoren).reverse()) as never;
    const a = parseKonfiguration(BASIS_KONFIGURATION);
    const b = parseKonfiguration(gedreht);
    if (!a.ok || !b.ok) throw new Error('unerwarteter Fehlschlag');
    expect([...b.wert.kern.faktoren.keys()]).toEqual([...a.wert.kern.faktoren.keys()]);
  });

  it('setzt konfigPruefsumme nicht — die bildet erst der Lader (E-26, PE-04)', () => {
    const r = parseKonfiguration(BASIS_KONFIGURATION);
    if (!r.ok) throw new Error('unerwarteter Fehlschlag');
    expect(r.wert.kern.konfigPruefsumme).toBeUndefined();
  });

  it('reicht die Fehler der drei Pruefebenen durch und bildet nichts teilweise ab', () => {
    const r = parseKonfiguration(baueKonfiguration((k) => { k.flaeche.alpha = 1.5; }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fehler.map((f) => f.code)).toContain('CFG_ALPHA_RANGE');
  });

  it('wirft nie, auch nicht bei voellig fremder Eingabe (Totalitaet)', () => {
    for (const eingabe of [null, 42, 'text', [], {}]) {
      const r = parseKonfiguration(eingabe);
      expect(r.ok).toBe(false);
    }
  });
});
