import { describe, expect, it } from 'vitest';
import { faktorId, lagescoreName, wohnungsnummer } from '../../src/domain/ids.js';

describe('Bezeichnertypen', () => {
  it('reicht den Zeichenkettenwert unveraendert durch', () => {
    expect(wohnungsnummer('A-01')).toBe('A-01');
    expect(faktorId('lage_gesamt')).toBe('lage_gesamt');
    expect(lagescoreName('location')).toBe('location');
  });

  it('weist eine leere Bezeichnung zurueck', () => {
    expect(() => wohnungsnummer('')).toThrow(/leer/);
    expect(() => faktorId('   ')).toThrow(/leer/);
  });
});
