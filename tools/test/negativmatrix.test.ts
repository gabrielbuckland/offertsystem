import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEGATIVMATRIX } from '../gen-config-invalid.ts';

// An der Testdatei verankert, nicht an process.cwd(): Vitest wechselt das Arbeitsverzeichnis
// nicht (bleibt Repository-Wurzel), ein Sprung ueber '..' ab cwd zielte eine Ebene zu hoch.
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
