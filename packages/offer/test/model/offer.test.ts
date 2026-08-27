import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { offerSchema } from '../../src/model/offer.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

describe('offerSchema — Rundungsordnung (E-09)', () => {
  it('nimmt einen ungerundeten Quadratmeterpreis an', () => {
    const roh = baueBeispielOfferte();
    roh.derivation.apartmentTypes[0]!.pricePerSqm.value = 1234.5678;
    expect(() => offerSchema.parse(roh)).not.toThrow();
  });

  it('weist einen nicht ganzzahligen Wohnungspreis zurueck (R2 ist Rappen)', () => {
    const roh = baueBeispielOfferte();
    roh.derivation.units[0]!.unitPrice.value = 99.5;
    expect(() => offerSchema.parse(roh)).toThrow();
  });

  it('weist eine nicht ganzzahlige Honorargrenze zurueck (R3 ist Rappen)', () => {
    const roh = baueBeispielOfferte();
    roh.aggregates.feeRange.value.min = 12.3;
    expect(() => offerSchema.parse(roh)).toThrow();
  });
});

describe('offerSchema — erster Bereich fuehrt die Projektkennung (Spec 05 §8)', () => {
  it('fuehrt im ersten Bereich die Kennung des erzeugenden Projekts', () => {
    const offerte = baueBeispielOfferte();
    expect(offerte.project.projektId).toMatch(/^[0-9a-f-]{36}$/);
    expect((offerte.project as Record<string, unknown>)['referenznummer']).toBeUndefined();
  });
});

describe('offerSchema — Aufbau der fuenf Bereiche', () => {
  it('nimmt das vollstaendige Beispielobjekt an', () => {
    expect(() => offerSchema.parse(baueBeispielOfferte())).not.toThrow();
  });

  it('kennt genau die fuenf Bereiche plus optionaler Dokumentblock', () => {
    expect(Object.keys(offerSchema.shape)).toEqual(
      ['project', 'property', 'derivation', 'aggregates', 'metadata', 'dokument'],
    );
  });

  it('weist ein unbekanntes Feld zurueck statt es zu ignorieren', () => {
    const roh = { ...baueBeispielOfferte(), zusatz: 'x' };
    expect(() => offerSchema.parse(roh)).toThrow();
  });

  it('weist eine Anpassungssumme <= -1 zurueck (I-06)', () => {
    const roh = baueBeispielOfferte();
    roh.derivation.units[0]!.adjustmentSum.value = -1;
    expect(() => offerSchema.parse(roh)).toThrow();
  });

  it('haelt die Faktorliste datengetrieben — kein Faktorbezeichner im Schema', () => {
    const quelle = readFileSync(new URL('../../src/model/offer.ts', import.meta.url), 'utf8');
    for (const verboten of ['lage_gesamt', 'projektumfang', 'preissegment', 'objektzustand']) {
      expect(quelle).not.toContain(verboten);
    }
  });
});
