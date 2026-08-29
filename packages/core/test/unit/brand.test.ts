import { describe, expect, it } from 'vitest';
import { faktorId, wohnungsnummer } from '../../src/domain/ids.js';

describe('Bezeichnertypen', () => {
  it('weist eine leere Bezeichnung zurueck', () => {
    expect(() => wohnungsnummer('')).toThrow(/leer/);
    expect(() => faktorId('   ')).toThrow(/leer/);
  });
});
