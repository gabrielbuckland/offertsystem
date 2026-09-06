/**
 * Fixture-Provider (E-31): echter Adapter samt Token-Verwaltung, Schemavalidierung und
 * PATCH-Rueckvergleich, Transport aus den aufgezeichneten Antworten der produktiven API.
 * Die Parametrisierung in `aufgezeichneteAnfrage` entspricht exakt dem aufgezeichneten
 * Dossierstand — nur so besteht der Rueckvergleich (byte-identisches Replay).
 */
import type { BewertungsAnfrage, LagescoreName, WohnungstypId } from '@offert/core';
import { describe, expect, it } from 'vitest';
import { createValuationProvider } from '../src/provider/factory.js';
import { adresse } from './adapter-hilfen.js';
import { ladeFixture } from './fixtures.js';
import { testKonfiguration } from './test-konfiguration.js';

function fixtureProvider() {
  return createValuationProvider({ VALUATION_PROVIDER: 'fixture' }, testKonfiguration());
}

function aufgezeichneteAnfrage(): BewertungsAnfrage {
  return {
    adresse,
    wohnungstypId: 'T-3.5' as WohnungstypId,
    zimmerzahl: 3.5,
    parametrisierung: {
      flaecheInnen: 82 as BewertungsAnfrage['parametrisierung']['flaecheInnen'],
      flaecheAussen: 0 as BewertungsAnfrage['parametrisierung']['flaecheAussen'],
      stockwerk: 2,
      energielabel: '',
      zustandsbewertungen: {
        bathrooms: 'new_or_recently_renovated', kitchen: 'new_or_recently_renovated',
        flooring: 'new_or_recently_renovated', windows: 'new_or_recently_renovated',
      },
      qualitaetsbewertungen: {
        bathrooms: 'high_quality', kitchen: 'high_quality',
        flooring: 'high_quality', windows: 'high_quality',
      },
      anzahlBadezimmer: 1,
      lift: false,
      baujahr: 1934,
      heizungsart: '',
    },
  };
}

describe('Fixture-Provider auf aufgezeichneten Antworten (E-31, FF 2)', () => {
  it('liefert die aufgezeichnete Referenzbewertung durch den ganzen Adapterpfad', async () => {
    const aufgezeichnet = ladeFixture<{
      valuationSale: { value: number; valuationConfidence: string; valuationDate: string };
    }>('recorded/dossier/valuation.success.json');

    const ergebnis = await fixtureProvider().bewerteWohnungstypen([aufgezeichneteAnfrage()]);

    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.vollstaendig).toBe(true);
    const bewertung = ergebnis.wert.bewertungen.get('T-3.5' as WohnungstypId);
    expect(bewertung?.anbieter).toBe('pricehubble');
    expect(bewertung?.marktwert).toBe(aufgezeichnet.valuationSale.value * 100);
    expect(bewertung?.bewertungsdatum).toBe(aufgezeichnet.valuationSale.valuationDate);
    expect(bewertung?.anzeige.konfidenzklasse).toBe(aufgezeichnet.valuationSale.valuationConfidence);
  });

  it('meldet eine vom Dossierstand abweichende Parametrisierung als Vertragsbruch', async () => {
    const abweichend: BewertungsAnfrage = {
      ...aufgezeichneteAnfrage(),
      parametrisierung: { ...aufgezeichneteAnfrage().parametrisierung, baujahr: 1999 },
    };

    const ergebnis = await fixtureProvider().bewerteWohnungstypen([abweichend]);

    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.vollstaendig).toBe(false);
    if (ergebnis.wert.vollstaendig) return;
    expect(ergebnis.wert.fehlgeschlagenerTyp).toBe('T-3.5');
  });

  it('liefert die aufgezeichneten Lagescores durch Schema und Mapper', async () => {
    const aufgezeichnet = ladeFixture<{ scores: Record<string, { score: number }> }>(
      'recorded/location/location-scores.success.json',
    );

    const ergebnis = await fixtureProvider().holeLagescores(adresse);

    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.anbieter).toBe('pricehubble');
    expect(ergebnis.wert.werte.get('location' as LagescoreName)).toBe(
      aufgezeichnet.scores['location']?.score,
    );
    expect(ergebnis.wert.werte.get('noise' as LagescoreName)).toBe(
      aufgezeichnet.scores['noise']?.score,
    );
  });
});
