import { describe, expect, it } from 'vitest';
import { standardKonfiguration } from '../helper/projekt.js';
import { kurz, lies, ohneKommentare, quelldateien } from './quelltext.js';

/**
 * GELTUNGSBEREICH DIESER PRUEFUNG.
 *
 * I-13 verlangt, dass die BERECHNUNG keinen Faktor privilegiert: keine
 * faktorspezifische Fallunterscheidung, kein Bezeichner als Literal. Geprueft wird
 * deshalb `src/pipeline/**`, `src/modell/**` und `src/normalization/**`. Zusaetzlich werden die
 * UI-Komponenten in `apps/web/src/components/einstellungen/**` und
 * `apps/web/src/components/pipeline/**` geprueft: Diese muessen ebenfalls alle
 * Faktoren iterativ aus der Konfiguration beziehen, nicht fest verdrahten.
 *
 * `src/config/**` ist ausgenommen, und zwar aus einem inhaltlichen Grund: Die
 * Konfigurationsvalidierung MUSS die neun Lagescore-Namen des Anbieters kennen, um
 * einen unaufloesbaren `quellSchluessel` mit `CFG_SOURCE_UNRESOLVED` zurueckzuweisen
 * (Ebene 3). Diese Liste ist Validierungswissen ueber ein fremdes Datenformat, keine
 * Bevorzugung eines Faktors in der Rechnung. Verboete man sie, bliebe nur die
 * Alternative, jeden Tippfehler im Quellschluessel bis in die Berechnung durchzulassen
 * — das Gegenteil dessen, was I-13 erreichen will.
 */
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
    // Gegenprobe zur Begruendung oben — waechst die Ausnahme, faellt es hier auf.
    const treffer = quelldateien('config')
      .filter((d) => ohneKommentare(lies(d)).includes("'location'"))
      .map(kurz);
    expect(treffer).toEqual(['packages/core/src/config/schema.ts']);
  });
});
