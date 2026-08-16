import { describe, expect, it } from 'vitest';
import { kurz, lies, ohneKommentare, quelldateien } from './quelltext.js';

const dateien = quelldateien();

describe('Determinismus-Verbote im Kern (Spec 03 §9.1, NFA-06)', () => {
  it.each([
    'Date.now', 'new Date', 'performance.now', 'Math.random', 'crypto.randomUUID',
    'localeCompare', 'toLocaleString', 'process.env',
  ])('kein Vorkommen von %s in packages/core/src', (verbot) => {
    const treffer = dateien
      .filter((d) => ohneKommentare(lies(d)).includes(verbot))
      .map(kurz);
    expect(treffer).toEqual([]);
  });

  it('liest weder Dateisystem noch Netz', () => {
    for (const d of dateien) {
      const inhalt = lies(d);
      // Ausnahme: config/toleranzen.ts importiert invariants.json als Datendatei (E-17).
      if (d.endsWith('config/toleranzen.ts')) continue;
      expect(inhalt, kurz(d)).not.toMatch(/from 'node:(fs|http|https|net)'/);
      expect(ohneKommentare(inhalt), kurz(d)).not.toContain('fetch(');
    }
  });

  it('importiert nichts aus den aeusseren Paketen (I-23, NFA-02)', () => {
    for (const d of dateien) {
      const inhalt = ohneKommentare(lies(d));
      for (const verboten of ['packages/pricehubble', 'packages/offer', 'apps/web',
        "from 'react'", "from 'next", "from 'axios'"]) {
        expect(inhalt, `${kurz(d)} nennt ${verboten}`).not.toContain(verboten);
      }
    }
  });
});
