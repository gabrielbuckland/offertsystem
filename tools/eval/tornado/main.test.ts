import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hauptlauf } from './main.ts';

describe('Abnahmetest F4 (Spec 06 §7.4)', () => {
  it('erfuellt F4: drei Vektorgrafiken plus zugrunde liegende CSV', () => {
    const verzeichnis = hauptlauf();
    for (const s of ['V', 'Hmin', 'Hmax']) {
      expect(existsSync(join(verzeichnis, `tornado-${s}.pdf`))).toBe(true);
      expect(existsSync(join(verzeichnis, `tornado-${s}.csv`))).toBe(true);
      expect(readFileSync(join(verzeichnis, `tornado-${s}.pdf`), 'latin1').startsWith('%PDF'))
        .toBe(true);
    }
    const artefakt = JSON.parse(
      readFileSync(join(verzeichnis, 'tornado.json'), 'utf8'),
    ) as { schwelle_prozent: number };
    expect(artefakt.schwelle_prozent).toBe(10);
  });
});
