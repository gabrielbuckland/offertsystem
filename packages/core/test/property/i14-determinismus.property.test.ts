import fc from 'fast-check';
import { describe, it } from 'vitest';
import { berechne } from '../../src/pipeline/berechne.js';
import { projektGenerator } from './generatoren.js';
import { pruefeProperty } from './protokoll.js';
import konfig from './seed.json' with { type: 'json' };

describe('I-14 Determinismus (Property)', () => {
  it('zwei Laeufe liefern strukturell identische Ergebnisobjekte', () => {
    pruefeProperty('I-14', konfig.numRuns, () => {
      fc.assert(
        fc.property(projektGenerator(), (args) => {
          const a = berechne(args);
          const b = berechne(args);
          return JSON.stringify(a, ersetzeMaps) === JSON.stringify(b, ersetzeMaps);
        }),
      );
    });
  });
});

function ersetzeMaps(_schluessel: string, wert: unknown): unknown {
  return wert instanceof Map ? [...wert.entries()].sort() : wert;
}
