import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYGROUND_ID, seedePlayground } from '../seed-playground.ts';

describe('seedePlayground', () => {
  it('legt das Playground-Projekt in eine leere Ablage', () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), 'seed-'));
    expect(seedePlayground(verzeichnis)).toBe(true);
    const ziel = join(verzeichnis, `${PLAYGROUND_ID}.json`);
    expect(existsSync(ziel)).toBe(true);
    const projekt = JSON.parse(readFileSync(ziel, 'utf8')) as { id: string };
    expect(projekt.id).toBe(PLAYGROUND_ID);
  });

  it('laesst eine Ablage mit bestehendem Projekt unangetastet', () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), 'seed-'));
    writeFileSync(join(verzeichnis, 'eigenes.json'), '{}');
    expect(seedePlayground(verzeichnis)).toBe(false);
    expect(existsSync(join(verzeichnis, `${PLAYGROUND_ID}.json`))).toBe(false);
  });
});
