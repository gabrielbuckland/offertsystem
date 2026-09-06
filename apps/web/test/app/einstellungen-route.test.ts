import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { leereZwischenspeicher } from '../../src/server/konfigurations-lader.js';
import { POST } from '../../src/app/api/einstellungen/route.js';

const STANDARD = resolve(import.meta.dirname, '../../../../config/company-defaults.json');
const urspruenglich = { ...process.env };

let pfad: string;

beforeEach(() => {
  const verzeichnis = mkdtempSync(join(tmpdir(), 'offert-einstellungen-route-'));
  pfad = join(verzeichnis, 'company-defaults.json');
  copyFileSync(STANDARD, pfad);
  leereZwischenspeicher();
  process.env['VALUATION_PROVIDER'] = 'mock';
  process.env['COMPANY_DEFAULTS_PATH'] = pfad;
});

afterEach(() => {
  process.env = { ...urspruenglich };
});

function standardRoh(): Record<string, unknown> {
  return JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, unknown>;
}

function anfrageMit(koerper: unknown): Request {
  return new Request('http://localhost/api/einstellungen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof koerper === 'string' ? koerper : JSON.stringify(koerper),
  });
}

async function jsonVon(antwort: Response): Promise<Record<string, unknown>> {
  return (await antwort.json()) as Record<string, unknown>;
}

describe('POST /api/einstellungen', () => {
  it('weist einen kaputten JSON-Rumpf mit 422 zurueck', async () => {
    const antwort = await POST(anfrageMit('{ kaputt'));
    expect(antwort.status).toBe(422);
  });

  it('weist eine Invariantenverletzung mit 422 und befunde[] zurueck', async () => {
    const roh = standardRoh();
    const honorar = roh['honorar'] as Record<string, unknown>;
    const stuetzstellen = honorar['stuetzstellen'] as Array<Record<string, unknown>>;
    (stuetzstellen[1] as Record<string, unknown>)['hMin'] = 999999999;
    const antwort = await POST(anfrageMit(roh));
    expect(antwort.status).toBe(422);
    const koerper = await jsonVon(antwort);
    expect(Array.isArray(koerper['befunde'])).toBe(true);
  });

  it('schreibt eine gueltige Konfiguration mit 200 und pruefsumme', async () => {
    const roh = standardRoh();
    const preisanpassung = roh['preisanpassung'] as Record<string, unknown>;
    preisanpassung['begruendungMinLaenge'] = 12;
    const antwort = await POST(anfrageMit(roh));
    expect(antwort.status).toBe(200);
    const koerper = await jsonVon(antwort);
    expect(koerper['pruefsumme']).toMatch(/^[0-9a-f]{64}$/);
  });
});
