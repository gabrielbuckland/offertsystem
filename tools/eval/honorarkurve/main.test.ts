import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hauptlauf } from './main.ts';

describe('Honorarkurven-Artefakt', () => {
  it('schreibt Vektorgrafik, CSV und Kennzahlen mit Markierung der knappsten Marge', () => {
    const verzeichnis = hauptlauf();
    expect(readFileSync(join(verzeichnis, 'honorarkurve.pdf'), 'latin1').startsWith('%PDF'))
      .toBe(true);
    expect(existsSync(join(verzeichnis, 'honorarkurve.csv'))).toBe(true);

    const artefakt = JSON.parse(
      readFileSync(join(verzeichnis, 'honorarkurve.json'), 'utf8'),
    ) as {
      bereich_rappen: { von: number; bis: number };
      markierung: { v_rappen: number } | null;
    };
    expect(artefakt.markierung).not.toBeNull();
    expect(artefakt.markierung!.v_rappen)
      .toBeGreaterThanOrEqual(artefakt.bereich_rappen.von);
    expect(artefakt.markierung!.v_rappen)
      .toBeLessThanOrEqual(artefakt.bereich_rappen.bis);
  });
});
