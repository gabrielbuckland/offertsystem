import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEGATIVMATRIX } from '../gen-config-invalid.ts';

/**
 * An der Testdatei verankert, nicht an `process.cwd()`. Vitest setzt fuer ein
 * Workspace-Projekt zwar `root`, wechselt aber nicht das Arbeitsverzeichnis —
 * das bleibt die Repository-Wurzel. Ein Sprung ueber `..` ab `cwd` zielte
 * deshalb eine Ebene zu hoch und liess die Pruefung fehlschlagen, obwohl die
 * Fixtures vorhanden waren.
 */
const ZIEL = resolve(import.meta.dirname, '../../packages/core/test/fixtures/config-invalid');

describe('Negativmatrix', () => {
  it('fuehrt jede Datei genau einmal', () => {
    const dateien = NEGATIVMATRIX.map((eintrag) => eintrag.datei);
    expect(new Set(dateien).size).toBe(dateien.length);
  });

  it('hat fuer jeden Eintrag eine erzeugte Fixture', () => {
    for (const eintrag of NEGATIVMATRIX) {
      expect(existsSync(resolve(ZIEL, eintrag.datei))).toBe(true);
    }
  });
});
