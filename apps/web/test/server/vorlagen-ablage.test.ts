import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { standardVorlage } from '@offert/offer/src/vorlage/standard-vorlage.js';
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
    expect(vorlage.inhalt).toEqual(standardVorlage());
  });

  it('schreibt eine gültige Vorlage und liest sie wieder', async () => {
    const pfad = join(await mkdtemp(join(tmpdir(), 'vorlage-')), 'offert-vorlage.json');
    const ergebnis = await schreibeVorlage(GUELTIG, pfad);
    expect(ergebnis.ok).toBe(true);
    expect((await ladeVorlage(pfad)).inhalt).toEqual(GUELTIG.inhalt);
    expect(JSON.parse(await readFile(pfad, 'utf8'))).toEqual(GUELTIG);
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
});
