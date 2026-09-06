import { describe, expect, it } from 'vitest';
import { standardKonfiguration } from '../helper/projekt.js';
import { kurz, lies, ohneKommentare, quelldateien } from './quelltext.js';

// I-13: `src/config/**` ist von der Literal-Pruefung ausgenommen, weil die
// Konfigurationsvalidierung die neun Lagescore-Namen kennen MUSS, um einen
// unaufloesbaren `quellSchluessel` mit CFG_SOURCE_UNRESOLVED zurueckzuweisen
// (Ebene 3) — Validierungswissen ueber ein fremdes Format, keine Faktorbevorzugung.
const RECHENPFADE = [
  'pipeline',
  'modell',
  'normalization',
  '../../../apps/web/src/components/einstellungen',
  '../../../apps/web/src/components/pipeline',
];

describe('I-13 — kein Faktorbezeichner als Literal in der Berechnung', () => {
  const dateien = RECHENPFADE.flatMap((p) => quelldateien(p));

  it('kein Rechenpfad nennt einen konfigurierten Faktorbezeichner', () => {
    const bezeichner = [...standardKonfiguration().faktoren.keys()].map(String);
    const treffer: string[] = [];
    for (const d of dateien) {
      const code = ohneKommentare(lies(d));
      for (const b of bezeichner) if (code.includes(b)) treffer.push(`${kurz(d)}:${b}`);
    }
    expect(treffer).toEqual([]);
  });

  it('kein Rechenpfad nennt einen der neun Lagescore-Namen', () => {
    const scores = ['location', 'family', 'health', 'leisure', 'shopping', 'catering',
      'view', 'noise', 'nuisance'];
    for (const d of dateien) {
      const code = ohneKommentare(lies(d));
      for (const s of scores) {
        expect(code, `${kurz(d)} nennt '${s}'`).not.toContain(`'${s}'`);
      }
    }
  });

  it('die Ausnahme fuer die Konfigurationspruefung ist eng: nur schema.ts fuehrt die Namen', () => {
    // Gegenprobe: waechst die Ausnahme fuer config ueber schema.ts hinaus, faellt es hier auf.
    const treffer = quelldateien('config')
      .filter((d) => ohneKommentare(lies(d)).includes("'location'"))
      .map(kurz);
    expect(treffer).toEqual(['packages/core/src/config/schema.ts']);
  });
});
