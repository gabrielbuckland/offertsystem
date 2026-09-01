/**
 * Der Route Handler wird gegen die echte Verdrahtung gefahren: `VALUATION_PROVIDER=mock`
 * liefert einen Provider ohne Netzzugriff, `OFFERTEN_VERZEICHNIS` zeigt auf ein
 * Temporaerverzeichnis. Attrappen fuer `berechne` waeren hier irrefuehrend — geprueft
 * wird gerade, dass im Fehlerfall NICHTS abgelegt wird, und das haengt an der echten
 * Reihenfolge im Handler.
 */
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { leereZwischenspeicher } from '../../src/server/konfigurations-lader.js';
import { BEWERTUNGEN_STANDARD } from '../bau/bewertungen.js';
import { POST } from '../../src/app/api/offerte/route.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');
const urspruenglich = { ...process.env };

let ablage: string;

beforeEach(async () => {
  ablage = await mkdtemp(join(tmpdir(), 'offerten-'));
  leereZwischenspeicher();
  process.env['VALUATION_PROVIDER'] = 'mock';
  process.env['COMPANY_DEFAULTS_PATH'] = `${WURZEL}/config/company-defaults.json`;
  process.env['OFFERTEN_VERZEICHNIS'] = ablage;
});

afterEach(() => {
  process.env = { ...urspruenglich };
});

function beispielErfassung(): Record<string, unknown> {
  return {
    projekt: { projektId: '11111111-1111-4111-8111-111111111111' },
    liegenschaft: {
      adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
    },
    wohnungstypen: [{
      id: 'T-3.5', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 82, flaecheAussen: 12, stockwerk: 2, energielabel: 'A',
        ...BEWERTUNGEN_STANDARD,
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'Waermepumpe',
      },
    }],
    einheiten: Array.from({ length: 6 }, (_, i) => ({
      wohnungsnummer: `A${i + 1}.01`, wohnungstypId: 'T-3.5',
      flaecheInnen: 82, flaecheAussen: 12, anpassungen: [],
    })),
    aufwandfaktoren: { innenausbau_qualitaet: 4 },
  };
}

function anfrageMit(koerper: unknown): Request {
  return new Request('http://localhost/api/offerte', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(koerper),
  });
}

async function jsonVon(antwort: Response): Promise<Record<string, unknown>> {
  return (await antwort.json()) as Record<string, unknown>;
}

describe('POST /api/offerte', () => {
  it('legt die Offerte im Verzeichnis aus der Umgebung ab, nicht im Standardpfad (PE-24)', async () => {
    const antwort = await POST(anfrageMit(beispielErfassung()));
    expect(antwort.status).toBe(201);
    expect((await readdir(ablage)).filter((d) => d.endsWith('.json'))).toHaveLength(1);
  });

  it('weist eine verletzende Erfassung feldverankert zurueck und legt nichts ab', async () => {
    const kaputt = beispielErfassung();
    (kaputt['liegenschaft'] as Record<string, unknown>)['grundstuecksflaeche'] = -1;
    const antwort = await POST(anfrageMit(kaputt));
    expect(antwort.status).toBe(422);
    const koerper = await jsonVon(antwort);
    expect(Array.isArray(koerper['meldungen'])).toBe(true);
    expect(await readdir(ablage)).toEqual([]);
  });

  it('weist eine nicht als UUID geformte Projekt-Kennung feldverankert zurueck, statt '
    + 'nach dem Berechnungslauf unbehandelt zu scheitern', async () => {
    const kaputt = beispielErfassung();
    kaputt['projekt'] = { projektId: 'A-2026-014' };
    const antwort = await POST(anfrageMit(kaputt));
    expect(antwort.status).toBe(422);
    const koerper = await jsonVon(antwort);
    const meldungen = koerper['meldungen'] as { feldpfad: string; text: string }[];
    expect(Array.isArray(meldungen)).toBe(true);
    expect(meldungen.some((m) => m.feldpfad === 'projekt.projektId')).toBe(true);
    expect(await readdir(ablage)).toEqual([]);
  });

  it('legt bei einem Stufenfehler keine Offerte ab (I-24)', async () => {
    // Ohne einen konfigurierten manuellen Aufwandfaktor bricht die Pipeline mit
    // FAKTOR_FEHLT ab. Die Firmen-Defaults fuehren seit Konfigversion 1.1.0 keinen
    // manuellen Faktor mehr (config/README.md) — der Testfall laedt deshalb eine
    // abgewandelte Konfiguration MIT manuellem Faktor, denn geprueft wird hier nicht
    // die Standardkonfiguration, sondern dass im Fehlerfall NICHTS abgelegt wird.
    const roh = JSON.parse(
      await readFile(`${WURZEL}/config/company-defaults.json`, 'utf8'),
    ) as { aufwandfaktoren: Record<string, Record<string, unknown>> };
    roh.aufwandfaktoren['innenausbau_qualitaet'] = {
      bezeichnung: 'Qualitaet des Innenausbaus', quelle: 'manuell',
      quellSchluessel: 'innenausbau_qualitaet', strategie: 'minmax',
      min: 1, max: 6, gewicht: 0.25,
    };
    roh.aufwandfaktoren['lage_gesamt']!['gewicht'] = 0.3; // Summe der Gewichte wieder 1
    // Eigenes Verzeichnis — `ablage` muss am Testende leer sein (genau das ist die
    // Behauptung dieses Tests).
    const konfigPfad = join(
      await mkdtemp(join(tmpdir(), 'konfig-')), 'konfig-mit-manuellem-faktor.json');
    await writeFile(konfigPfad, JSON.stringify(roh));
    process.env['COMPANY_DEFAULTS_PATH'] = konfigPfad;
    leereZwischenspeicher();

    // Das Erfassungsschema laesst die leere Faktormenge zu — die Vollstaendigkeit je
    // Faktor prueft `pruefeFaktorwerte` in der Maske, nicht das Schema.
    const ohneFaktor = beispielErfassung();
    ohneFaktor['aufwandfaktoren'] = {};
    const antwort = await POST(anfrageMit(ohneFaktor));
    expect(antwort.status).toBe(422);
    expect(await readdir(ablage)).toEqual([]);
    const koerper = await jsonVon(antwort);
    expect((koerper['fehler'] as { text: string }).text).toContain('liegt kein Wert vor');
  });

  it('weist einen syntaktisch kaputten Rumpf mit 422 zurueck, nicht mit 500', async () => {
    const antwort = await POST(new Request('http://test/api/offerte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{kaputt',
    }));
    expect(antwort.status).toBe(422);
    const koerper = await jsonVon(antwort);
    expect((koerper['fehler'] as { text?: string } | undefined)?.text).toBeDefined();
  });
});
