import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { aggregateValuesSchema, priceDerivationSchema } from '@offert/offer';
import { POST } from '../../src/app/api/projekt/[id]/berechnung/route.js';
import { legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';
import { BEWERTUNGEN_STANDARD } from '../bau/bewertungen.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

async function vorbereitetesProjekt() {
  const v = await mkdtemp(join(tmpdir(), 'projekte-'));
  process.env['PROJEKTE_VERZEICHNIS'] = v;
  const p = await legeProjektAn(ADRESSE, v, standardKonfiguration());
  await speichereProjekt({
    ...p,
    referenzobjekte: [{
      id: 'R-1', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
        ...BEWERTUNGEN_STANDARD,
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
      },
    }],
    anpassungsSpalten: [],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19,
      spaltenwerte: {}, merkmalswerte: {},
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
  }, v);
  return p.id;
}

/**
 * Eigene Fixtur statt eines Parameters an `vorbereitetesProjekt`: Sie deckt genau die
 * Regressionsstelle ab, die zwei Basisplaeufe ohne echte `ohneAnpassungen`-Option
 * unmoeglich gemacht hat — eine in Franken erfasste Spalte, die den Basispreis braucht,
 * bevor der Basispreis existiert (PE-21).
 */
async function projektMitFrankenAnpassung() {
  const v = await mkdtemp(join(tmpdir(), 'projekte-'));
  process.env['PROJEKTE_VERZEICHNIS'] = v;
  const p = await legeProjektAn(ADRESSE, v, standardKonfiguration());
  await speichereProjekt({
    ...p,
    referenzobjekte: [{
      id: 'R-1', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
        ...BEWERTUNGEN_STANDARD,
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
      },
    }],
    anpassungsSpalten: [
      { id: 'S-1', bezeichnung: 'Aussicht', erfassungsform: 'absolut', vorgabewert: 0 },
    ],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19,
      spaltenwerte: { 'S-1': 10_000 }, merkmalswerte: {},
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
  }, v);
  return p.id;
}

beforeEach(() => {
  process.env['VALUATION_PROVIDER'] = 'mock';
});

describe('POST /api/projekt/[id]/berechnung', () => {
  it('liefert Preise je Einheit und die Aggregate', async () => {
    const id = await vorbereitetesProjekt();
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(200);
    const koerper = await antwort.json() as {
      einheiten: { wohnungsnummer: string; preis: number }[];
      verkaufssumme: number; honorarMin: number; honorarMax: number;
    };
    expect(koerper.einheiten).toHaveLength(1);
    expect(koerper.einheiten[0]!.wohnungsnummer).toBe('A-01');
    expect(koerper.verkaufssumme).toBeGreaterThan(0);
    expect(koerper.honorarMax).toBeGreaterThanOrEqual(koerper.honorarMin);
  });

  it('wendet einen in Franken erfassten Zuschlag wirksam an', async () => {
    const id = await projektMitFrankenAnpassung();
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(200);
    const koerper = await antwort.json() as {
      einheiten: { id: string; wohnungsnummer: string; basispreis: number; preis: number }[];
    };
    expect(koerper.einheiten).toHaveLength(1);
    const einheit = koerper.einheiten[0]!;
    expect(einheit.id).toBe('E-1');
    expect(einheit.wohnungsnummer).toBe('A-01');
    expect(einheit.preis).not.toBe(einheit.basispreis);
  });

  it('meldet ein unbekanntes Projekt mit 404', async () => {
    await vorbereitetesProjekt();
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000000' }) },
    );
    expect(antwort.status).toBe(404);
  });

  it('traegt die Herleitung des Offert-Schemas in der Antwort', async () => {
    const id = await vorbereitetesProjekt();
    const antwort = await POST(new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) });
    expect(antwort.status).toBe(200);
    const rumpf = await antwort.json() as {
      verkaufssumme: number; honorarMin: number; honorarMax: number;
      einheiten: { wohnungsnummer: string; basispreis: number; preis: number }[];
      herleitung?: {
        derivation: unknown;
        aggregates: unknown;
      };
    };
    expect(priceDerivationSchema.safeParse(rumpf.herleitung?.derivation).success).toBe(true);
    expect(aggregateValuesSchema.safeParse(rumpf.herleitung?.aggregates).success).toBe(true);

    // Der Kern der Zusammenlegung: EIN Datenbild, nicht zwei (NFA-07). Die flachen
    // Felder der Antwort sind Projektionen derselben Herleitung. Liefen beide je
    // auseinander, faellt genau diese Zusicherung — ohne sie pruefte der Test nur, dass
    // ueberhaupt etwas Schemakonformes mitgeschickt wird.
    const aggregate = aggregateValuesSchema.parse(rumpf.herleitung?.aggregates);
    expect(aggregate.totalSalesValue.value).toBe(rumpf.verkaufssumme);
    expect(aggregate.feeRange.value.min).toBe(rumpf.honorarMin);
    expect(aggregate.feeRange.value.max).toBe(rumpf.honorarMax);
    const herleitung = priceDerivationSchema.parse(rumpf.herleitung?.derivation);
    expect(herleitung.units.map((u) => u.unitNumber)).toEqual(
      rumpf.einheiten.map((e) => e.wohnungsnummer));
    expect(herleitung.units[0]!.unitPrice.value).toBe(rumpf.einheiten[0]!.preis);
    expect(herleitung.units[0]!.basePrice.value).toBe(rumpf.einheiten[0]!.basispreis);
  });

  it('rechnet mit dem Einstellungs-Delta des Projekts', async () => {
    // Beide Projekte im selben Verzeichnis, damit dieselbe Umgebung fuer beide
    // Anfragen gilt; eines der beiden erhaelt eine abweichende Skalierungsobergrenze.
    const v = await mkdtemp(join(tmpdir(), 'projekte-'));
    process.env['PROJEKTE_VERZEICHNIS'] = v;
    const ohne = await legeProjektAn(ADRESSE, v, standardKonfiguration());
    const mitRoh = await legeProjektAn(ADRESSE, v, standardKonfiguration());
    const mit = await speichereProjekt(
      { ...mitRoh, einstellungen: { honorar: { skalierung: { gMax: 1.2 } } } }, v);

    for (const projekt of [ohne, mit]) {
      await speichereProjekt({
        ...projekt,
        referenzobjekte: [{
          id: 'R-1', zimmerzahl: 3.5,
          parametrisierung: {
            flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
            ...BEWERTUNGEN_STANDARD,
            anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
          },
        }],
        anpassungsSpalten: [],
        einheiten: [{
          id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
          flaecheInnen: 86, flaecheAussen: 19,
          spaltenwerte: {}, merkmalswerte: {},
        }],
        aufwandfaktoren: { innenausbau_qualitaet: 3 },
      }, v);
    }

    const a = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id: ohne.id }) },
    );
    const b = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id: mit.id }) },
    );
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const rumpfA = await a.json() as { metadaten: { konfigPruefsumme: string } };
    const rumpfB = await b.json() as { metadaten: { konfigPruefsumme: string } };
    // Die Pruefsumme weist den PROJEKTBEZOGENEN Stand aus, nicht den Firmenstand.
    expect(rumpfB.metadaten.konfigPruefsumme).not.toBe(rumpfA.metadaten.konfigPruefsumme);
  });
});
