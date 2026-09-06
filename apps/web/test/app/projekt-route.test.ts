import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/route.js';

beforeEach(async () => {
  process.env['PROJEKTE_VERZEICHNIS'] = await mkdtemp(join(tmpdir(), 'projekte-'));
});

describe('POST /api/projekt', () => {
  it('weist einen syntaktisch kaputten Rumpf mit 422 zurueck, nicht mit 500', async () => {
    const antwort = await POST(new Request('http://test/api/projekt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{kaputt',
    }));
    expect(antwort.status).toBe(422);
    const rumpf = await antwort.json() as { fehler?: { text?: string } };
    expect(rumpf.fehler?.text).toBeDefined();
  });

  it('legt ein Projekt an und liefert 201 mit id', async () => {
    const antwort = await POST(new Request('http://test/api/projekt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' }),
    }));
    expect(antwort.status).toBe(201);
  });
});
