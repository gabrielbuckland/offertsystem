import { describe, expect, it } from 'vitest';
import { berechne } from '../../src/pipeline/berechne.js';
import { eingangsArgumente } from '../helper/projekt.js';

describe('berechne — Verkettung (Spec 03 §4.6)', () => {
  it('rechnet aus einem Fixture-Projekt V, D und die Honorarrange', () => {
    const r = berechne(eingangsArgumente());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.verkaufssumme.verkaufssumme).toBe(340_000_000); // 4 * 850 000 CHF
      expect(r.wert.gewichtung.aufwandindikator).toBeGreaterThanOrEqual(0);
      expect(r.wert.gewichtung.aufwandindikator).toBeLessThanOrEqual(1);
      expect(r.wert.honorar.honorarMin).toBeLessThan(r.wert.honorar.honorarMax);
    }
  });

  it('reicht den Fehler der ersten fehlschlagenden Stufe durch und rechnet nicht weiter', () => {
    const r = berechne(eingangsArgumente({ bewertungen: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.stufe).toBe(1);
      expect(r.fehler.code).toBe('REFERENZBEWERTUNG_FEHLT');
    }
  });

  it('gibt in keinem Fehlerfall ein Berechnungsergebnis aus (6.4 (c), I-24)', () => {
    const r = berechne(eingangsArgumente({ bewertungen: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fehler)).not.toContain('wert');
  });

  it('fuehrt die vollstaendige Referenzbewertung inklusive anzeige und die Lagescores (E-19)', () => {
    const r = berechne(eingangsArgumente());
    if (r.ok) {
      const b = [...r.wert.bewertungen.values()][0]!;
      expect(b.anzeige.konfidenzklasse).toBe('good');
      expect(b.anzeige.konfidenzbereich.von).toBeLessThan(b.anzeige.konfidenzbereich.bis);
      expect(b.parametrisierungsAbdruck.baujahr).toBe(2025);
      expect(r.wert.lagescores.meta.size).toBeGreaterThan(0);
    }
  });

  it('fuehrt die eingebettete Konfigurationskopie und den Zeitstempel mit (NFA-07, PE-04)', () => {
    const r = berechne(eingangsArgumente({ zeitstempel: '2026-08-16T10:00:00.000Z' }));
    if (r.ok) {
      expect(r.wert.zeitstempel).toBe('2026-08-16T10:00:00.000Z');
      // konfigurationsAbdruck ist die KOPIE, nicht der Fingerabdruck: pruefbar daran,
      // dass die Rechenparameter selbst darin stehen (PE-04).
      expect(r.wert.konfigurationsAbdruck.flaeche.alpha).toBe(0.5);
      expect(r.wert.konfigurationsAbdruck.faktoren.size).toBe(4);
      // Die Pruefsumme ist ein eigenes Feld und wird vom Lader gesetzt, nicht vom Kern.
      expect(r.wert.konfigurationsAbdruck.konfigPruefsumme).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('ist deterministisch: zwei Laeufe liefern tief-gleiche Ergebnisobjekte (I-14)', () => {
    const args = eingangsArgumente();
    const a = berechne(args);
    const b = berechne(args);
    expect(a).toStrictEqual(b);
  });

  it('mutiert die Eingabe nicht', () => {
    const args = eingangsArgumente();
    const vorher = structuredClone({
      einheiten: args.liegenschaft.einheiten.length,
      rohwerte: [...args.vermarkterFaktoren.werte.entries()],
    });
    berechne(args);
    expect(args.liegenschaft.einheiten.length).toBe(vorher.einheiten);
    expect([...args.vermarkterFaktoren.werte.entries()]).toEqual(vorher.rohwerte);
  });

  it('exportiert jede Stufe auch einzeln (NFA-03)', async () => {
    const api = await import('../../src/index.js');
    for (const name of ['bereiteEingabeAuf', 'berechneVerkaufssumme',
      'ergaenzeAbgeleiteteFaktoren', 'normalisiereFaktoren', 'berechneAufwandindikator',
      'bildeHonorarrange', 'berechne']) {
      expect(typeof (api as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('erhaelt P1s Exporte unveraendert (PE-15)', async () => {
    const api = await import('../../src/index.js');
    expect(api.PAKET_NAME).toBe('@offert/core');
    expect(typeof api.validiereKonfiguration).toBe('function');
    expect(typeof api.parseKonfiguration).toBe('function');
  });
});
