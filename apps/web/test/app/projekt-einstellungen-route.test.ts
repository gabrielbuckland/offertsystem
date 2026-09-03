/**
 * Deckt den Schreibweg der PROJEKTBEZOGENEN Ebene ab. Zurueckweisen statt
 * melden (I-21): Ein invariantenverletzendes oder gesperrtes Delta darf das
 * Projektartefakt nicht veraendern — mehrere Tests pruefen das ausdruecklich, indem
 * sie nach einer 422-Antwort erneut laden und `einstellungen` unveraendert vorfinden.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/projekt/[id]/einstellungen/route.js';
import { BEREICHE } from '../../src/app/(anwendung)/einstellungen/bereiche.js';
import { rahmenBefunde } from '../../src/components/einstellungen/EinstellungsEditor.js';
import { unverankerteBefunde } from '../../src/components/einstellungen/projekt-einstellungen-logik.js';
import { befundeFuerPfad } from '../../src/components/einstellungen/verwende-einstellungen.js';
import { ladeProjekt, legeProjektAn } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

/** Alle Bereichswurzeln der vier Karten — die Praefixe, an denen die Oberflaeche
 *  Befunde verankert (`bereiche.ts`). */
const WURZELN = Object.values(BEREICHE).flatMap(
  (bereich) => (typeof bereich.praefix === 'string' ? [bereich.praefix] : [...bereich.praefix]),
);

/**
 * Bildet die Anzeigeregeln der Projektebene nach: Rahmen je Bereich, Feld-Editor je
 * Zeile, Auffangblock fuer den Rest. Ein Befund, den keine der drei Regeln durchlaesst,
 * erreicht den Benutzer nicht (K-1).
 */
function wirdAngezeigt(befund: { readonly pfad: string; readonly text: string }): boolean {
  const inKarte = WURZELN.some((wurzel) => rahmenBefunde([befund], [wurzel]).length > 0
    || befundeFuerPfad([befund], wurzel).length > 0);
  return inKarte || unverankerteBefunde([befund], WURZELN).length > 0;
}

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

  it('verankert einen Konfigurationsbefund am Feldpfad statt pauschal am Formular (K-1)', async () => {
    const { projekt } = await vorbereitetesProjekt();
    const antwort = await POST(
      anfrage({ aufwandfaktoren: { lage_gesamt: { gewicht: 0.7 } } }),
      { params: Promise.resolve({ id: projekt.id }) },
    );
    expect(antwort.status).toBe(422);
    const rumpf = await antwort.json() as {
      befunde: readonly { pfad: string; text: string }[];
    };
    // Der frueher gesetzte Sammelanker `(konfiguration)` ist von keiner Karte greifbar.
    expect(rumpf.befunde.map((b) => b.pfad)).not.toContain('(konfiguration)');
    // Die Gewichtssumme wird auf der Bereichswurzel gemeldet — genau dort, wo die
    // Aufwandfaktoren-Karte ihre Rahmenbefunde zeigt.
    expect(rumpf.befunde.some((b) => b.pfad === 'aufwandfaktoren')).toBe(true);
    // Und der Text ist die Anzeigefassung aus `zuBefunden`, nicht die Maschinenform
    // `CODE bei pfad: {json}` aus `laufzeit.ts`.
    expect(rumpf.befunde.every((b) => !b.text.includes(' bei aufwandfaktoren: {'))).toBe(true);
  });

  it('liefert nur Befunde, die die Oberflaeche auch anzeigen kann (K-1)', async () => {
    const { projekt } = await vorbereitetesProjekt();
    for (const delta of [
      // Invariantenverletzung auf einer Bereichswurzel …
      { aufwandfaktoren: { lage_gesamt: { gewicht: 0.7 } } },
      // … und ein gesperrter Pfad, zu dem es GAR KEINE Karte gibt: `api` ist bewusst
      // kein Bereich der Oberflaeche. Ohne Auffangblock verschwaende diese Meldung.
      { api: { timeoutMs: 1 } },
    ]) {
      const antwort = await POST(
        anfrage(delta), { params: Promise.resolve({ id: projekt.id }) },
      );
      expect(antwort.status).toBe(422);
      const rumpf = await antwort.json() as {
        befunde: readonly { pfad: string; text: string }[];
      };
      expect(rumpf.befunde.length).toBeGreaterThan(0);
      for (const befund of rumpf.befunde) {
        expect(wirdAngezeigt(befund), `unsichtbar: ${JSON.stringify(befund)}`).toBe(true);
      }
    }
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
