import { describe, expect, it } from 'vitest';
import { DossierResponseSchema } from '../../src/schema/dossier-response.js';
import { LocationScoresResponseSchema } from '../../src/schema/location-scores-response.js';
import { LoginResponseSchema } from '../../src/schema/login-response.js';
import { ValuationResponseSchema } from '../../src/schema/valuation-response.js';
import { ladeFixture } from '../fixtures.js';

describe('Contract-Schema — tolerant nach oben (Spec 04 §5.3)', () => {
  it('akzeptiert die Login-Antwort', () => {
    expect(
      LoginResponseSchema.safeParse(ladeFixture('synthetic/auth/login.success.json')).success,
    ).toBe(true);
  });

  it('akzeptiert die Dossier-Antwort', () => {
    expect(
      DossierResponseSchema.safeParse(
        ladeFixture('synthetic/dossier/get-dossier.success.json'),
      ).success,
    ).toBe(true);
  });

  it('akzeptiert die Bewertungsantwort', () => {
    expect(
      ValuationResponseSchema.safeParse(
        ladeFixture('synthetic/dossier/valuation.success.json'),
      ).success,
    ).toBe(true);
  });

  it('toleriert ein unbekanntes Zusatzfeld und verwirft es (AK-5)', () => {
    const ergebnis = ValuationResponseSchema.safeParse(
      ladeFixture('synthetic/dossier/valuation.unknown-extra-field.json'),
    );
    expect(ergebnis.success).toBe(true);
    expect(ergebnis.success && 'marketTrendIndicator' in ergebnis.data).toBe(false);
  });

  it('toleriert ein fehlendes optionales Feld', () => {
    expect(
      ValuationResponseSchema.safeParse(
        ladeFixture('synthetic/dossier/valuation.no-confidence-score.json'),
      ).success,
    ).toBe(true);
  });
});

describe('Contract-Schema — streng nach unten (Spec 04 §5.3, Szenario 3)', () => {
  it('lehnt ein fehlendes Pflichtfeld ab und nennt den Pfad', () => {
    const ergebnis = ValuationResponseSchema.safeParse(
      ladeFixture('synthetic/dossier/valuation.missing-value.json'),
    );
    expect(ergebnis.success).toBe(false);
    expect(ergebnis.success === false && ergebnis.error.issues[0]!.path.join('.')).toBe(
      'valuationSale.value',
    );
  });

  it('lehnt eine Typabweichung ab und koerziert nicht', () => {
    const ergebnis = ValuationResponseSchema.safeParse(
      ladeFixture('synthetic/dossier/valuation.type-mismatch.json'),
    );
    expect(ergebnis.success).toBe(false);
  });

  it('lehnt eine invertierte Konfidenzspanne ab', () => {
    const ergebnis = ValuationResponseSchema.safeParse(
      ladeFixture('synthetic/dossier/valuation.range-inverted.json'),
    );
    expect(ergebnis.success).toBe(false);
  });

  it('lehnt einen Wert ausserhalb des Plausibilitaetsfensters ab', () => {
    const ergebnis = ValuationResponseSchema.safeParse({
      isValuationStale: false,
      valuationSale: {
        value: 5_000_000_000,
        valueRange: { lower: 1, upper: 9_000_000_000 },
        valuationConfidence: 'good',
        valuationDate: '2026-03-27',
      },
    });
    expect(ergebnis.success).toBe(false);
  });

  it('lehnt ein Bewertungsdatum in der Zukunft ab', () => {
    const morgen = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const ergebnis = ValuationResponseSchema.safeParse({
      isValuationStale: false,
      valuationSale: {
        value: 971000,
        valueRange: { lower: 893000, upper: 1079300 },
        valuationConfidence: 'good',
        valuationDate: morgen,
      },
    });
    expect(ergebnis.success).toBe(false);
  });

  it('verlangt genau neun Lagescores (E-22: Vertragsbruch, kein Sonderfall)', () => {
    expect(
      LocationScoresResponseSchema.safeParse(
        ladeFixture('synthetic/location/location-scores.success.json'),
      ).success,
    ).toBe(true);
    expect(
      LocationScoresResponseSchema.safeParse(
        ladeFixture('synthetic/location/location-scores.missing-score.json'),
      ).success,
    ).toBe(false);
  });

  it('akzeptiert uebersteuerte Scores', () => {
    expect(
      LocationScoresResponseSchema.safeParse(
        ladeFixture('synthetic/location/location-scores.overridden.json'),
      ).success,
    ).toBe(true);
  });
});
