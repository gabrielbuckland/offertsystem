import { describe, expect, it } from 'vitest';
import { faktorId } from '../../src/domain/ids.js';
import { sortiereNachSchluessel } from '../../src/util/sortierung.js';

describe('sortiereNachSchluessel (Spec 03 §9.3)', () => {
  it('durchlaeuft die Schluessel aufsteigend, unabhaengig von der Einfuegereihenfolge', () => {
    const a = new Map([
      [faktorId('projektumfang'), 1], [faktorId('lage_gesamt'), 2], [faktorId('preissegment'), 3],
    ]);
    const b = new Map([
      [faktorId('preissegment'), 3], [faktorId('projektumfang'), 1], [faktorId('lage_gesamt'), 2],
    ]);
    expect(sortiereNachSchluessel(a).map(([k]) => k))
      .toEqual(['lage_gesamt', 'preissegment', 'projektumfang']);
    expect(sortiereNachSchluessel(a)).toEqual(sortiereNachSchluessel(b));
  });

  it('vergleicht in Codepoint-Ordnung, nicht locale-abhaengig', () => {
    const m = new Map([[faktorId('Z_faktor'), 1], [faktorId('a_faktor'), 2]]);
    // Codepoint: Grossbuchstaben vor Kleinbuchstaben; localeCompare wuerde umgekehrt ordnen.
    expect(sortiereNachSchluessel(m).map(([k]) => k)).toEqual(['Z_faktor', 'a_faktor']);
  });
});
