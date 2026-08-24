import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/[id]/berechnung/route.js';
import { legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

async function vorbereitetesProjekt() {
  const v = await mkdtemp(join(tmpdir(), 'projekte-'));
  process.env['PROJEKTE_VERZEICHNIS'] = v;
  const p = await legeProjektAn(ADRESSE, v);
  await speichereProjekt({
    ...p,
    referenzobjekte: [{
      id: 'R-1', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
        zustandsbewertungen: {}, qualitaetsbewertungen: {},
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
      },
    }],
    anpassungsSpalten: [],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1,
      spaltenwerte: {}, manuelleAnpassungen: [],
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

  it('meldet ein unbekanntes Projekt mit 404', async () => {
    await vorbereitetesProjekt();
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000000' }) },
    );
    expect(antwort.status).toBe(404);
  });
});
