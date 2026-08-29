/**
 * Deckt den Schreibweg der PROJEKTBEZOGENEN Ebene ab (Task 6). Zurueckweisen statt
 * melden (I-21): Ein invariantenverletzendes oder gesperrtes Delta darf das
 * Projektartefakt nicht veraendern — mehrere Tests pruefen das ausdruecklich, indem
 * sie nach einer 422-Antwort erneut laden und `einstellungen` unveraendert vorfinden.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/[id]/einstellungen/route.js';
import { ladeProjekt, legeProjektAn } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

async function vorbereitetesProjekt() {
  const v = await mkdtemp(join(tmpdir(), 'projekte-'));
  process.env['PROJEKTE_VERZEICHNIS'] = v;
  const p = await legeProjektAn(ADRESSE, v, standardKonfiguration());
  return { projekt: p, verzeichnis: v };
}

function anfrage(rumpf: unknown): Request {
  return new Request('http://test/api', {
    method: 'POST', body: JSON.stringify(rumpf),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/projekt/[id]/einstellungen', () => {
  it('schreibt ein gueltiges Delta und meldet die neue Pruefsumme', async () => {
    const { projekt, verzeichnis } = await vorbereitetesProjekt();
    const antwort = await POST(
      anfrage({ flaeche: { alpha: 0.6 } }),
      { params: Promise.resolve({ id: projekt.id }) },
    );
    expect(antwort.status).toBe(200);
    const rumpf = await antwort.json() as { pruefsumme: string };
    expect(rumpf.pruefsumme).toMatch(/^[0-9a-f]{64}$/);
    const neu = await ladeProjekt(projekt.id, verzeichnis);
    expect(neu.einstellungen).toEqual({ flaeche: { alpha: 0.6 } });
  });

  it('weist ein invariantenverletzendes Delta zurueck und schreibt nichts', async () => {
    const { projekt, verzeichnis } = await vorbereitetesProjekt();
    const antwort = await POST(
      anfrage({ aufwandfaktoren: { lage_gesamt: { gewicht: 0.7 } } }),
      { params: Promise.resolve({ id: projekt.id }) },
    );
    expect(antwort.status).toBe(422);
    const rumpf = await antwort.json() as { befunde: readonly { pfad: string }[] };
    expect(rumpf.befunde.length).toBeGreaterThan(0);
    // Zurueckweisen statt melden (I-21): Das Artefakt bleibt unangetastet.
    const neu = await ladeProjekt(projekt.id, verzeichnis);
    expect(neu.einstellungen).toBeUndefined();
  });

  it('weist einen gesperrten Pfad zurueck', async () => {
    const { projekt } = await vorbereitetesProjekt();
    const antwort = await POST(
      anfrage({ api: { timeoutMs: 1 } }),
      { params: Promise.resolve({ id: projekt.id }) },
    );
    expect(antwort.status).toBe(422);
  });

  it('antwortet auf kaputtes JSON mit 422, nicht mit 500', async () => {
    const { projekt } = await vorbereitetesProjekt();
    const kaputt = new Request('http://test/api', { method: 'POST', body: '{' });
    const antwort = await POST(kaputt, { params: Promise.resolve({ id: projekt.id }) });
    expect(antwort.status).toBe(422);
  });

  it('meldet ein unbekanntes Projekt mit 404', async () => {
    await vorbereitetesProjekt();
    const antwort = await POST(
      anfrage({ flaeche: { alpha: 0.6 } }),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000000' }) },
    );
    expect(antwort.status).toBe(404);
  });
});
