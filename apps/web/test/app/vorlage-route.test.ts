import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../src/app/api/vorlage/route.js';

beforeEach(async () => {
  process.env['VALUATION_PROVIDER'] = 'mock';
  process.env['OFFERT_VORLAGE_PATH'] =
    join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
});

describe('/api/vorlage', () => {
  it('GET liefert ohne Datei die Standardvorlage', async () => {
    const antwort = await GET();
    expect(antwort.status).toBe(200);
    const koerper = await antwort.json() as { version: string; inhalt: { type: string } };
    expect(koerper.inhalt.type).toBe('doc');
  });

  it('POST speichert eine gültige Vorlage, GET liefert sie zurück', async () => {
    const rumpf = {
      version: '1',
      inhalt: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Neu' }] }],
      },
    };
    const post = await POST(new Request('http://test', {
      method: 'POST', body: JSON.stringify(rumpf),
      headers: { 'content-type': 'application/json' },
    }));
    expect(post.status).toBe(200);
    const get = await GET();
    expect((await get.json() as typeof rumpf).inhalt).toEqual(rumpf.inhalt);
  });

  it('POST weist eine ungültige Vorlage mit 422 und Befunden zurück', async () => {
    const post = await POST(new Request('http://test', {
      method: 'POST', body: JSON.stringify({ version: '1', inhalt: { type: 'doc' } }),
      headers: { 'content-type': 'application/json' },
    }));
    expect(post.status).toBe(422);
    expect(((await post.json()) as { befunde: unknown[] }).befunde.length)
      .toBeGreaterThan(0);
  });

  it('POST ignoriert eine vom Client gesendete Version (I-5)', async () => {
    const rumpf = {
      version: '42',
      inhalt: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Neu' }] }],
      },
    };
    await POST(new Request('http://test', {
      method: 'POST', body: JSON.stringify(rumpf),
      headers: { 'content-type': 'application/json' },
    }));
    const get = await GET();
    const koerper = await get.json() as { version: string };
    expect(koerper.version).not.toBe('42');
  });

  it('GET meldet ein defektes Vorlagenartefakt mit 500 statt einer unbehandelten Ausnahme (I-4)', async () => {
    const pfad = process.env['OFFERT_VORLAGE_PATH']!;
    await writeFile(pfad, '{ kaputtes json', 'utf8');
    const antwort = await GET();
    expect(antwort.status).toBe(500);
    const koerper = await antwort.json() as { fehler: { text: string } };
    expect(koerper.fehler.text.length).toBeGreaterThan(0);
  });
});
