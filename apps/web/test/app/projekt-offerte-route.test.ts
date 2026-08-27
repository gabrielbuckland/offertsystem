import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/[id]/offerte/route.js';
import { ladeProjekt, legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { ladeOfferte, listeOfferten } from '../../src/server/offerten-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

async function projekteUndOffertenVerzeichnis() {
  const projekte = await mkdtemp(join(tmpdir(), 'projekte-'));
  const offerten = await mkdtemp(join(tmpdir(), 'offerten-'));
  process.env['PROJEKTE_VERZEICHNIS'] = projekte;
  process.env['OFFERTEN_VERZEICHNIS'] = offerten;
  return { projekte, offerten };
}

// `auftraggeber` optional: Die Standardvorlage verwendet {auftraggeber} und verlangt ihn
// erst beim Finalisieren (Task 8) — nur Faelle, die eine erfolgreiche Offerte erwarten,
// geben ihn hier mit; der 422-Fall bleibt bewusst ohne.
async function vorbereitetesProjekt(projekte: string, auftraggeber?: string) {
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
      flaecheInnen: 86, flaecheAussen: 19,
      spaltenwerte: {}, merkmalswerte: {},
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
    ...(auftraggeber === undefined ? {} : { auftraggeber }),
  }, projekte);
  return p.id;
}

beforeEach(async () => {
  process.env['VALUATION_PROVIDER'] = 'mock';
  // Frisches Temp-Verzeichnis je Testfall: Die Standardvorlage darf nicht ueber eine
  // zuvor von einem anderen Test geschriebene Datei am selben Pfad einwirken.
  process.env['OFFERT_VORLAGE_PATH'] =
    join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
});

describe('POST /api/projekt/[id]/offerte', () => {
  it('erzeugt eine Offerte, die die Kennung des erzeugenden Projekts fuehrt', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const id = await vorbereitetesProjekt(projekte, 'Muster Immobilien AG');
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

  it('legt das aufgelöste Offert-Dokument im Artefakt ab (Standardvorlage)', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    process.env['OFFERT_VORLAGE_PATH'] =
      join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const id = await vorbereitetesProjekt(projekte);
    // Die Standardvorlage verwendet {auftraggeber} — das Projekt muss ihn liefern.
    const projekt = await ladeProjekt(id, projekte);
    await speichereProjekt({ ...projekt, auftraggeber: 'Muster Immobilien AG' }, projekte);

    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(201);
    const { offertId } = await antwort.json() as { offertId: string };
    const offerte = await ladeOfferte(offertId, offerten);
    expect(offerte.dokument).toBeDefined();
    expect(offerte.dokument!.auftraggeber).toBe('Muster Immobilien AG');
    // Aufgelöst heisst: keine Platzhalter-Knoten mehr im Inhalt.
    expect(JSON.stringify(offerte.dokument!.inhalt)).not.toContain('platzhalter');
    expect(JSON.stringify(offerte.dokument!.inhalt)).toContain('Muster Immobilien AG');
  });

  it('meldet einen fehlenden Auftraggeber mit 422 und legt kein Artefakt ab', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    process.env['OFFERT_VORLAGE_PATH'] =
      join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const id = await vorbereitetesProjekt(projekte); // ohne auftraggeber
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(422);
    const koerper = await antwort.json() as { fehler: { text: string } };
    expect(koerper.fehler.text).toContain('auftraggeber');
    expect(await listeOfferten(offerten)).toHaveLength(0);
  });

  it('verwendet den projektspezifischen Offerttext, wenn einer vorliegt', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    process.env['OFFERT_VORLAGE_PATH'] =
      join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const id = await vorbereitetesProjekt(projekte);
    const projekt = await ladeProjekt(id, projekte);
    await speichereProjekt({
      ...projekt,
      offertText: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Individueller Text für ' },
            { type: 'platzhalter', attrs: { id: 'ort' } },
          ],
        }],
      },
    }, projekte);
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(201);
    const { offertId } = await antwort.json() as { offertId: string };
    const offerte = await ladeOfferte(offertId, offerten);
    // `loeseDokumentAuf` (Task 3) ersetzt den Platzhalter-Knoten durch einen EIGENEN
    // Textknoten, ohne ihn mit Nachbartext zu verschmelzen (siehe
    // packages/offer/test/vorlage/aufloesung.test.ts) — «für Zürich» steht deshalb nicht
    // als zusammenhängende Zeichenkette im JSON. Geprüft wird daher auf beide Bestandteile.
    const inhalt = JSON.stringify(offerte.dokument!.inhalt);
    expect(inhalt).toContain('Individueller Text für');
    expect(inhalt).toContain('Zürich');
  });
});
