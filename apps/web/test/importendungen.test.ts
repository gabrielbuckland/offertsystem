import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * PE-14 verlangt die explizite `.js`-Endung bei relativen Importen. Weder `tsc`
 * (moduleResolution `Bundler`) noch ESLint noch `check:deps` decken das in
 * `apps/web` ab, deshalb steht die Regel hier.
 */
const SRC = resolve(import.meta.dirname, '../src');
const ERLAUBTE_ENDUNGEN = ['.js', '.css', '.json'];

function quelldateien(verzeichnis: string = SRC): readonly string[] {
  return readdirSync(verzeichnis, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) return quelldateien(pfad);
    return pfad.endsWith('.ts') || pfad.endsWith('.tsx') ? [pfad] : [];
  });
}

/** Statisch (`import`/`export ... from`, auch `import type`) und dynamisch (`import(...)`). */
function relativeSpezifizierer(inhalt: string): readonly string[] {
  return [...inhalt.matchAll(/(?:from|import)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g)].map((m) => m[1]!);
}

describe('PE-14 — explizite Dateiendung bei relativen Importen', () => {
  it('kein relativer Import in apps/web/src ohne .js/.css/.json-Endung', () => {
    const dateien = quelldateien();
    expect(dateien.length, 'keine Quelldateien gefunden — Pfad falsch?').toBeGreaterThan(0);

    const verstoesse = dateien.flatMap((datei) =>
      relativeSpezifizierer(readFileSync(datei, 'utf8'))
        .filter((s) => !ERLAUBTE_ENDUNGEN.some((endung) => s.endsWith(endung)))
        .map((s) => `${datei.slice(datei.indexOf('apps/web/src'))}: '${s}'`));

    expect(verstoesse).toEqual([]);
  });
});
