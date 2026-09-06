/**
 * End-to-End-Nachweis (E-31, FF 2): Aus den per `test:record` aufgezeichneten Antworten
 * der produktiven PriceHubble-API entsteht ueber den Betriebspfad (POST /api/offerte,
 * echter Adapter samt Schemavalidierung und PATCH-Rueckvergleich) eine deterministische
 * Offerte. Die Erfassung entspricht exakt dem aufgezeichneten Dossierstand — nur so
 * besteht der Rueckvergleich des Adapters (byte-identisches Replay, kein Netz).
 */
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { leereZwischenspeicher } from '../../src/server/konfigurations-lader.js';
import { POST } from '../../src/app/api/offerte/route.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');
const urspruenglich = { ...process.env };

let ablage: string;

beforeEach(async () => {
  ablage = await mkdtemp(join(tmpdir(), 'offerten-aufzeichnung-'));
  leereZwischenspeicher();
  process.env['VALUATION_PROVIDER'] = 'fixture';
  process.env['COMPANY_DEFAULTS_PATH'] = `${WURZEL}/config/company-defaults.json`;
  process.env['OFFERTEN_VERZEICHNIS'] = ablage;
});

afterEach(() => {
  process.env = { ...urspruenglich };
});

/** Parametrisierung = aufgezeichneter Dossierstand; Adresse = anonymisierte Fixture-Adresse. */
function erfassungZurAufzeichnung(): Record<string, unknown> {
  return {
    projekt: { projektId: '00000000-0000-4000-8000-0000000000e3' },
    liegenschaft: {
      adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
    },
    wohnungstypen: [{
      id: 'T-3.5', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 82, flaecheAussen: 0, stockwerk: 2, energielabel: '',
        zustandsbewertungen: {
          bathrooms: 'new_or_recently_renovated', kitchen: 'new_or_recently_renovated',
          flooring: 'new_or_recently_renovated', windows: 'new_or_recently_renovated',
        },
        qualitaetsbewertungen: {
          bathrooms: 'high_quality', kitchen: 'high_quality',
          flooring: 'high_quality', windows: 'high_quality',
        },
        anzahlBadezimmer: 1, lift: false, baujahr: 1934, heizungsart: '',
      },
    }],
    einheiten: Array.from({ length: 4 }, (_, i) => ({
      wohnungsnummer: `A${i + 1}.01`, wohnungstypId: 'T-3.5',
      flaecheInnen: 82, flaecheAussen: 0, anpassungen: [],
    })),
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
  };
}

interface AbgelegteOfferte {
  readonly property: {
    readonly lagescores: ReadonlyArray<{ value: { name: string; score: number } }>;
  };
  readonly derivation: {
    readonly apartmentTypes: ReadonlyArray<{
      readonly referenceValuation: {
        readonly value: { marktwert: number; bewertungsdatum: string };
        readonly provenance: string;
      };
    }>;
  };
  readonly aggregates: {
    readonly totalSalesValue: { value: number };
    readonly effortFactors: ReadonlyArray<{ id: string; rawValue: number }>;
    readonly feeRange: { value: { min: number; max: number } };
  };
}

async function abgelegteOfferte(): Promise<AbgelegteOfferte> {
  const dateien = (await readdir(ablage)).filter((d) => d.endsWith('.json'));
  expect(dateien).toHaveLength(1);
  return JSON.parse(await readFile(join(ablage, String(dateien[0])), 'utf8')) as AbgelegteOfferte;
}

async function fixture<T>(relativ: string): Promise<T> {
  return JSON.parse(
    await readFile(join(WURZEL, 'fixtures', 'pricehubble', 'recorded', relativ), 'utf8'),
  ) as T;
}

describe('POST /api/offerte mit aufgezeichneten API-Antworten (E-31, FF 2)', () => {
  it('erzeugt aus dem aufgezeichneten Marktwert deterministisch eine vollstaendige Offerte', async () => {
    const bewertung = await fixture<{
      valuationSale: { value: number; valuationDate: string };
    }>('dossier/valuation.success.json');
    const lage = await fixture<{ scores: Record<string, { score: number }> }>(
      'location/location-scores.success.json',
    );

    const antwort = await POST(new Request('http://localhost/api/offerte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(erfassungZurAufzeichnung()),
    }));

    expect(antwort.status).toBe(201);
    const offerte = await abgelegteOfferte();

    // Referenzbewertung = aufgezeichneter Marktwert, als PriceHubble-Herkunft ausgewiesen.
    const referenz = offerte.derivation.apartmentTypes[0]?.referenceValuation;
    const marktwertRappen = bewertung.valuationSale.value * 100;
    expect(referenz?.provenance).toBe('pricehubble');
    expect(referenz?.value.marktwert).toBe(marktwertRappen);
    expect(referenz?.value.bewertungsdatum).toBe(bewertung.valuationSale.valuationDate);

    // Lagescore und Verkaufssumme folgen deterministisch aus der Aufzeichnung.
    const lageInOfferte = offerte.property.lagescores.find((s) => s.value.name === 'location');
    expect(lageInOfferte?.value.score).toBe(lage.scores['location']?.score);
    expect(
      offerte.aggregates.effortFactors.find((f) => f.id === 'lage_gesamt')?.rawValue,
    ).toBe(lage.scores['location']?.score);
    expect(offerte.aggregates.totalSalesValue.value).toBe(4 * marktwertRappen);

    // Honorarband, festgepinnt auf die Aufzeichnung vom 2026-09-06 (Marktwert CHF 1'416'400):
    // eine Abweichung hiesse, dass sich Rechenkette oder Aufzeichnungsstand geaendert haben.
    expect(offerte.aggregates.feeRange.value).toEqual({ min: 12_291_035, max: 16_388_046 });
  });
});
