import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/[id]/offerte/route.js';
import { ladeProjekt, legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { ladeOfferte, listeOfferten } from '../../src/server/offerten-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

// Ein von der (in diesen Tests nicht berechneten) Range unabhaengiger, aber formal
// gueltiger Betrag: Die Route lehnt eine Abweichung von der Honorarrange nicht ab
// (honorar-eingabe.ts, Spec 2026-08-29) — nur das Format wird hier geprueft.
const GEWAEHLTES_HONORAR = 5_000_000_00;

function anfrageMitHonorar(gewaehltesHonorar: unknown = GEWAEHLTES_HONORAR): Request {
  return new Request('http://test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gewaehltesHonorar }),
  });
}

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
      anfrageMitHonorar(),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(201);
    const koerper = await antwort.json() as { offertId: string };
    expect(koerper.offertId).toBeTruthy();

    const liste = await listeOfferten(offerten);
    expect(liste).toHaveLength(1);
    expect(liste[0]!.fehlerhaft).toBe(false);
    expect(liste[0]!.liegenschaft).toContain('Seestrasse');

    const offerte = await ladeOfferte(koerper.offertId, offerten);
    expect(offerte.aggregates.gewaehltesHonorar).toEqual({
      value: GEWAEHLTES_HONORAR, provenance: 'marketer-decision',
    });
  });

  it('weist einen fehlenden Honorarbetrag zurueck und legt kein Artefakt ab', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const id = await vorbereitetesProjekt(projekte, 'Muster Immobilien AG');
    const antwort = await POST(
      new Request('http://test', { method: 'POST' }),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(422);
    const koerper = await antwort.json() as { fehler: { text: string } };
    expect(koerper.fehler.text).toContain('Honorarbetrag');
    expect(await listeOfferten(offerten)).toHaveLength(0);
  });

  it('weist einen nicht ganzzahligen Honorarbetrag zurueck und legt kein Artefakt ab', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const id = await vorbereitetesProjekt(projekte, 'Muster Immobilien AG');
    const antwort = await POST(
      anfrageMitHonorar(123.45),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(422);
    const koerper = await antwort.json() as { fehler: { text: string } };
    expect(koerper.fehler.text).toContain('ganzzahlig');
    expect(await listeOfferten(offerten)).toHaveLength(0);
  });

  it('akzeptiert einen formal gueltigen Honorarbetrag ausserhalb der Range (Empfehlung, '
    + 'keine Schranke)', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const id = await vorbereitetesProjekt(projekte, 'Muster Immobilien AG');
    // Bewusst weit ausserhalb jeder plausiblen Range fuer dieses winzige Testprojekt.
    const antwort = await POST(
      anfrageMitHonorar(1),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(201);
    const { offertId } = await antwort.json() as { offertId: string };
    const offerte = await ladeOfferte(offertId, offerten);
    expect(offerte.aggregates.gewaehltesHonorar).toEqual({ value: 1, provenance: 'marketer-decision' });
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
      anfrageMitHonorar(),
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
      anfrageMitHonorar(),
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
      anfrageMitHonorar(),
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

  it('führt eine serverseitig bestimmte vorlageVersion, keine Konstante (I-5)', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const id = await vorbereitetesProjekt(projekte, 'Muster Immobilien AG');
    const antwort = await POST(
      anfrageMitHonorar(),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(201);
    const { offertId } = await antwort.json() as { offertId: string };
    const offerte = await ladeOfferte(offertId, offerten);
    // Die Standardvorlage wurde nicht ueber /api/vorlage geschrieben — ihre Version ist
    // die eingebaute `VORLAGE_VERSION` ('1', vorlagen-ablage.ts `ladeVorlage`-Fallback für
    // eine fehlende Datei). I-5 betrifft den SCHREIBweg: Sobald eine Vorlage abgelegt
    // wird, bestimmt der Server die Version — das prüft `vorlagen-ablage.test.ts` direkt.
    expect(offerte.dokument!.vorlageVersion).toBe('1');
  });

  it('meldet eine defekte Vorlagendatei beim Finalisieren mit 500 statt einer '
    + 'unbehandelten Ausnahme (I-4)', async () => {
    const { projekte, offerten } = await projekteUndOffertenVerzeichnis();
    const id = await vorbereitetesProjekt(projekte, 'Muster Immobilien AG');
    await writeFile(process.env['OFFERT_VORLAGE_PATH']!, '{ kaputtes json', 'utf8');

    const antwort = await POST(
      anfrageMitHonorar(),
      { params: Promise.resolve({ id }) },
    );
    expect(antwort.status).toBe(500);
    const koerper = await antwort.json() as { fehler: { text: string } };
    expect(koerper.fehler.text).toContain('Vorlage');
    expect(await listeOfferten(offerten)).toHaveLength(0);
  });
});
