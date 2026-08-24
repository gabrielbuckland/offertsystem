/**
 * Deckt die Rumpfbehandlung der Speicherroute ab. Ein nicht parsierbarer Rumpf trifft
 * `anfrage.json()`, BEVOR `safeParse` laeuft — ohne eigenen Fang entstuende dort eine 500
 * statt der spezifizierten 422, und der Client saehe einen Serverfehler, wo ein
 * Eingabefehler vorliegt.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUT } from '../../src/app/api/projekt/[id]/route.js';
import { legeProjektAn } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

async function vorbereitetesProjekt() {
  const v = await mkdtemp(join(tmpdir(), 'projekte-'));
  process.env['PROJEKTE_VERZEICHNIS'] = v;
  return legeProjektAn(ADRESSE, v, standardKonfiguration());
}

function anfrageMit(rumpf: string): Request {
  return new Request('http://test', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: rumpf,
  });
}

describe('PUT /api/projekt/[id]', () => {
  it('beantwortet einen nicht parsierbaren Rumpf mit 422 statt mit 500', async () => {
    const p = await vorbereitetesProjekt();
    const antwort = await PUT(
      anfrageMit('{"schemaVersion":'), { params: Promise.resolve({ id: p.id }) });
    expect(antwort.status).toBe(422);
  });

  it('beantwortet einen leeren Rumpf mit 422 statt mit 500', async () => {
    const p = await vorbereitetesProjekt();
    const antwort = await PUT(anfrageMit(''), { params: Promise.resolve({ id: p.id }) });
    expect(antwort.status).toBe(422);
  });

  it('speichert einen gueltigen Stand', async () => {
    const p = await vorbereitetesProjekt();
    const antwort = await PUT(
      anfrageMit(JSON.stringify(p)), { params: Promise.resolve({ id: p.id }) });
    expect(antwort.status).toBe(204);
  });
});
