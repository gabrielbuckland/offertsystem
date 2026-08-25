import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/[id]/offerte/route.js';
import { legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { listeOfferten } from '../../src/server/offerten-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

async function projekteUndOffertenVerzeichnis() {
  const projekte = await mkdtemp(join(tmpdir(), 'projekte-'));
  const offerten = await mkdtemp(join(tmpdir(), 'offerten-'));
  process.env['PROJEKTE_VERZEICHNIS'] = projekte;
  process.env['OFFERTEN_VERZEICHNIS'] = offerten;
  return { projekte, offerten };
}

async function vorbereitetesProjekt(projekte: string) {
  const p = await legeProjektAn(ADRESSE, projekte, standardKonfiguration());
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
      spaltenwerte: {},
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
  }, projekte);
  return p.id;
}

beforeEach(() => {
  process.env['VALUATION_PROVIDER'] = 'mock';
});

describe('POST /api/projekt/[id]/offerte', () => {
  it('erzeugt eine Offerte, die die Kennung des erzeugenden Projekts fuehrt', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const id = await vorbereitetesProjekt(projekte);
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(201);
    const koerper = await antwort.json() as { offertId: string };
    expect(koerper.offertId).toBeTruthy();

    const liste = await listeOfferten(offerten);
    expect(liste).toHaveLength(1);
    expect(liste[0]!.fehlerhaft).toBe(false);
    expect(liste[0]!.liegenschaft).toContain('Seestrasse');
  });

  it('meldet ein unbekanntes Projekt mit 404 und legt kein Artefakt ab (I-24)', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    await vorbereitetesProjekt(projekte);
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000000' }) },
    );
    expect(antwort.status).toBe(404);
    expect(await listeOfferten(offerten)).toHaveLength(0);
  });

  it('meldet ein unvollstaendiges Projekt, ohne eine Offerte zu erzeugen', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const p = await legeProjektAn(ADRESSE, projekte, standardKonfiguration());
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id: p.id }) },
    );
    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toEqual({ unvollstaendig: true });
    expect(await listeOfferten(offerten)).toHaveLength(0);
  });
});
