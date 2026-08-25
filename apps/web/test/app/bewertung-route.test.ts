import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/[id]/bewertung/route.js';
import { ladeProjekt, legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

beforeEach(() => { process.env['VALUATION_PROVIDER'] = 'mock'; });

describe('POST /api/projekt/[id]/bewertung', () => {
  it('schreibt den bezogenen Referenzwert in das Projekt', async () => {
    const v = await mkdtemp(join(tmpdir(), 'projekte-'));
    process.env['PROJEKTE_VERZEICHNIS'] = v;
    const p = await legeProjektAn(ADRESSE, v, standardKonfiguration());
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
      einheiten: [{
        id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
        flaecheInnen: 86, flaecheAussen: 19,
        spaltenwerte: {},
      }],
    }, v);

    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id: p.id }) },
    );
    expect(antwort.status).toBe(200);

    const danach = await ladeProjekt(p.id, v);
    expect(danach.referenzobjekte[0]!.bewertung).toBeDefined();
    expect(danach.referenzobjekte[0]!.bewertung!.wert).toBeGreaterThan(0);
  });
});
