import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { standardVorlage } from '@offert/offer/src/vorlage/standard-vorlage.js';
import { bildePruefsumme } from '../../src/server/kanonisch.js';
import { ladeVorlage, schreibeVorlage } from '../../src/server/vorlagen-ablage.js';

const GUELTIG = {
  version: '1',
  inhalt: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Eigener Text' }] }],
  },
};

describe('vorlagen-ablage', () => {
  it('liefert die Standardvorlage, solange keine Datei existiert', async () => {
    const verzeichnis = await mkdtemp(join(tmpdir(), 'vorlage-'));
    const vorlage = await ladeVorlage(join(verzeichnis, 'offert-vorlage.json'));
    expect(vorlage.ok).toBe(true);
    if (vorlage.ok) expect(vorlage.wert.inhalt).toEqual(standardVorlage());
  });

  it('schreibt eine gültige Vorlage und liest sie wieder', async () => {
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const ergebnis = await schreibeVorlage(GUELTIG, pfad);
    expect(ergebnis.ok).toBe(true);
    const gelesen = await ladeVorlage(pfad);
    expect(gelesen.ok).toBe(true);
    if (gelesen.ok) expect(gelesen.wert.inhalt).toEqual(GUELTIG.inhalt);
    const aufDatei = JSON.parse(await readFile(pfad, 'utf8')) as { version: string };
    // I-5: Die abgelegte Version ist die inhaltliche Pruefsumme, NICHT der vom Client
    // gesendete Wert ('1') — schreibeVorlage ignoriert `roh.version`.
    expect(aufDatei.version).toBe(bildePruefsumme(GUELTIG.inhalt));
  });

  it('bestimmt die Version serverseitig und ignoriert eine vom Client gesendete (I-5)', async () => {
    const pfadA = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const pfadB = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    await schreibeVorlage({ ...GUELTIG, version: '1' }, pfadA);
    await schreibeVorlage({ ...GUELTIG, version: '99999' }, pfadB);
    const a = await ladeVorlage(pfadA);
    const b = await ladeVorlage(pfadB);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      // Gleicher Inhalt -> gleiche abgeleitete Version, unabhaengig vom Client-Wert.
      expect(a.wert.version).toBe(b.wert.version);
      expect(a.wert.version).not.toBe('1');
      expect(a.wert.version).not.toBe('99999');
    }
  });

  it('weist eine Vorlage mit unbekanntem Platzhalter zurück, ohne zu schreiben', async () => {
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const kaputt = {
      version: '1',
      inhalt: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'platzhalter', attrs: { id: 'kaufpreis' } }],
        }],
      },
    };
    const ergebnis = await schreibeVorlage(kaputt, pfad);
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.befunde[0]!.text).toContain('kaufpreis');
    await expect(readFile(pfad, 'utf8')).rejects.toThrow();
  });

  it('weist strukturell ungültiges JSON mit Befunden zurück', async () => {
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const ergebnis = await schreibeVorlage({ version: '1', inhalt: { type: 'kaputt' } }, pfad);
    expect(ergebnis.ok).toBe(false);
  });

  it('weist einen inline-Platzhalter mit id «preistabelle» zurück (M-1)', async () => {
    // Katalog und Auflösung sind sich sonst uneinig: `preistabelle` waere als
    // Text-Platzhalter (statt als Blockknoten `platzhalterTabelle`) in der
    // Speicherpruefung faelschlich zulaessig, aber bei jedem Finalisieren
    // «Unbekannter Platzhalter» — genau das soll die Speicherpruefung verhindern.
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const inlinePreistabelle = {
      version: '1',
      inhalt: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'platzhalter', attrs: { id: 'preistabelle' } }],
        }],
      },
    };
    const ergebnis = await schreibeVorlage(inlinePreistabelle, pfad);
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.befunde[0]!.text).toContain('preistabelle');
  });

  it('akzeptiert «preistabelle» als Blockknoten (platzhalterTabelle)', async () => {
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const blockPreistabelle = {
      version: '1',
      inhalt: { type: 'doc', content: [{ type: 'platzhalterTabelle' }] },
    };
    const ergebnis = await schreibeVorlage(blockPreistabelle, pfad);
    expect(ergebnis.ok).toBe(true);
  });

  it('legt das Zielverzeichnis an, falls es noch nicht existiert (I-3)', async () => {
    const basis = await mkdtemp(join(tmpdir(), 'vorlage-'));
    const pfad = join(basis, 'noch', 'nicht', 'vorhanden', 'offert-vorlage.json');
    const ergebnis = await schreibeVorlage(GUELTIG, pfad);
    expect(ergebnis.ok).toBe(true);
    const gelesen = await ladeVorlage(pfad);
    expect(gelesen.ok).toBe(true);
  });

  it('meldet ein defektes JSON-Artefakt als Befund statt zu werfen (I-4)', async () => {
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    await writeFile(pfad, '{ nicht: gueltiges json', 'utf8');
    const ergebnis = await ladeVorlage(pfad);
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.meldung.length).toBeGreaterThan(0);
  });

  it('meldet ein schemawidriges Artefakt als Befund statt zu werfen (I-4)', async () => {
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    await writeFile(pfad, JSON.stringify({ version: '1', inhalt: { type: 'kaputt' } }), 'utf8');
    const ergebnis = await ladeVorlage(pfad);
    expect(ergebnis.ok).toBe(false);
  });

  it('hinterlässt keine `.tmp`-Reste im Zielverzeichnis (I-3, schreibeAtomar)', async () => {
    const verzeichnis = await mkdtemp(join(tmpdir(), 'vorlage-'));
    const pfad = join(verzeichnis, 'offert-vorlage.json');
    await schreibeVorlage(GUELTIG, pfad);
    const dateien = await readdir(verzeichnis);
    expect(dateien).toEqual(['offert-vorlage.json']);
  });
});
