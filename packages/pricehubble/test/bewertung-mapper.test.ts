import type { RepraesentativeParametrisierung, WohnungstypId } from '@offert/core';
import { describe, expect, it } from 'vitest';
import {
  aufReferenzbewertung,
  dossierBody,
} from '../src/acl/bewertung-mapper.js';
import { verifiziereGesendetePatchFelder } from '../src/acl/patch-verifikation.js';
import { ValuationResponseSchema } from '../src/schema/valuation-response.js';
import { ladeFixture } from './fixtures.js';

const parametrisierung: RepraesentativeParametrisierung = {
  flaecheInnen: 82 as RepraesentativeParametrisierung['flaecheInnen'],
  flaecheAussen: 12 as RepraesentativeParametrisierung['flaecheAussen'],
  stockwerk: 2,
  energielabel: 'minergie' as const,
  zustandsbewertungen: {
    bathrooms: 'new_or_recently_renovated', kitchen: 'new_or_recently_renovated',
    flooring: 'new_or_recently_renovated', windows: 'new_or_recently_renovated',
  },
  qualitaetsbewertungen: {
    bathrooms: 'high_quality', kitchen: 'high_quality',
    flooring: 'high_quality', windows: 'high_quality',
  },
  anzahlBadezimmer: 1,
  lift: true,
  baujahr: 2026,
  heizungsart: 'heat_pump_air' as const,
};

const antwort = ValuationResponseSchema.parse(
  ladeFixture('synthetic/dossier/valuation.success.json'),
);

describe('ACL-Mapping der Bewertung (Spec 04 §4.1, E-21)', () => {
  it('bildet valuationSale.value als Rappen auf marktwert ab (Rundungsstelle R1)', () => {
    const bewertung = aufReferenzbewertung({
      wohnungstypId: 't-1' as WohnungstypId,
      antwort,
      parametrisierungsAbdruck: parametrisierung,
    });
    expect(bewertung.marktwert).toBe(97_100_000);
  });

  it('fuehrt den Konfidenzbereich ausschliesslich in anzeige (Rundungsstelle R0)', () => {
    const bewertung = aufReferenzbewertung({
      wohnungstypId: 't-1' as WohnungstypId,
      antwort,
      parametrisierungsAbdruck: parametrisierung,
    });
    expect(bewertung.anzeige.konfidenzbereich).toEqual({ von: 89_300_000, bis: 107_930_000 });
    expect(bewertung.anzeige.konfidenzklasse).toBe('good');
    expect(bewertung.anzeige.konfidenzwert).toBeCloseTo(0.191266805, 9);
  });

  it('uebernimmt das Bewertungsdatum als Zeichenkette ohne Date-Umwandlung', () => {
    const bewertung = aufReferenzbewertung({
      wohnungstypId: 't-1' as WohnungstypId,
      antwort,
      parametrisierungsAbdruck: parametrisierung,
    });
    expect(bewertung.bewertungsdatum).toBe('2026-03-27');
    expect(typeof bewertung.bewertungsdatum).toBe('string');
  });

  it('belegt anbieter konstant mit pricehubble (Herkunftsnachweis A-13)', () => {
    const bewertung = aufReferenzbewertung({
      wohnungstypId: 't-1' as WohnungstypId,
      antwort,
      parametrisierungsAbdruck: parametrisierung,
    });
    expect(bewertung.anbieter).toBe('pricehubble');
  });

  it('heftet den gesendeten Parameterstand als parametrisierungsAbdruck an (AK-20)', () => {
    const bewertung = aufReferenzbewertung({
      wohnungstypId: 't-1' as WohnungstypId,
      antwort,
      parametrisierungsAbdruck: parametrisierung,
    });
    expect(bewertung.parametrisierungsAbdruck).toEqual(parametrisierung);
  });

  it('laesst konfidenzwert weg, wenn das optionale Feld fehlt', () => {
    const ohne = ValuationResponseSchema.parse(
      ladeFixture('synthetic/dossier/valuation.no-confidence-score.json'),
    );
    const bewertung = aufReferenzbewertung({
      wohnungstypId: 't-1' as WohnungstypId,
      antwort: ohne,
      parametrisierungsAbdruck: parametrisierung,
    });
    expect(bewertung.anzeige.konfidenzwert).toBeUndefined();
  });
});

describe('E3-Body und PATCH-Verifikation (Spec 04 §1.4, §5.4)', () => {
  it('sendet genau die zehn Felder der RepraesentativeParametrisierung (E-28)', () => {
    expect(dossierBody(parametrisierung)).toEqual({
      property: {
        livingArea: 82,
        balconyArea: 12,
        floorNumber: 2,
        energyLabel: 'minergie',
        condition: {
          bathrooms: 'new_or_recently_renovated', kitchen: 'new_or_recently_renovated',
          flooring: 'new_or_recently_renovated', windows: 'new_or_recently_renovated',
        },
        quality: {
          bathrooms: 'high_quality', kitchen: 'high_quality',
          flooring: 'high_quality', windows: 'high_quality',
        },
        numberOfBathrooms: 1,
        hasLift: true,
        buildingYear: 2026,
        heatingGenerationType: 'heat_pump_air',
      },
    });
  });

  it('setzt gardenArea nicht (Aussenflaeche → balconyArea, Nachfuehrung N-17)', () => {
    expect('gardenArea' in dossierBody(parametrisierung).property).toBe(false);
  });

  it('akzeptiert eine Antwort, die die gesendeten Werte zurueckmeldet', () => {
    const gesendet = dossierBody(parametrisierung);
    expect(verifiziereGesendetePatchFelder(gesendet, { property: { ...gesendet.property } }))
      .toEqual([]);
  });

  it('toleriert Gleitkommaabweichungen bis 1e-9', () => {
    const gesendet = dossierBody(parametrisierung);
    const antwortBody = { property: { ...gesendet.property, livingArea: 82 + 1e-10 } };
    expect(verifiziereGesendetePatchFelder(gesendet, antwortBody)).toEqual([]);
  });

  it('meldet ein still veraendertes Feld als Abweichung', () => {
    const gesendet = dossierBody(parametrisierung);
    const antwortBody = { property: { ...gesendet.property, livingArea: 80 } };
    expect(verifiziereGesendetePatchFelder(gesendet, antwortBody)).toEqual([
      'property.livingArea',
    ]);
  });

  it('meldet ein ignoriertes Feld als Abweichung', () => {
    const gesendet = dossierBody(parametrisierung);
    const { hasLift: _entfernt, ...rest } = gesendet.property;
    expect(verifiziereGesendetePatchFelder(gesendet, { property: rest })).toEqual([
      'property.hasLift',
    ]);
  });

  it('sendet condition und quality mit genau den vier PriceHubble-Feldern', () => {
    const body = dossierBody(parametrisierung);
    // `DossierBody['property']` ist ein loses `Readonly<Record<string, unknown>>`; die
    // Feldnamen sind dort nicht typisiert, `Object.keys` braucht darum den Cast.
    expect(Object.keys(body.property['condition'] as object).sort())
      .toEqual(['bathrooms', 'flooring', 'kitchen', 'windows']);
    expect(Object.keys(body.property['quality'] as object).sort())
      .toEqual(['bathrooms', 'flooring', 'kitchen', 'windows']);
  });
});
