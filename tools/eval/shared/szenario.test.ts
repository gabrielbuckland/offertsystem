import { describe, expect, it } from 'vitest';
import { ladeSzenarien } from './szenario.ts';

describe('ladeSzenarien', () => {
  it('laedt die Szenarien einschliesslich der beiden Projektvarianten von S4', () => {
    expect(ladeSzenarien().map((s) => s.szenario_id)).toEqual(
      expect.arrayContaining(['S1', 'S2', 'S3', 'S4a', 'S4b', 'S5']),
    );
  });

  it('fuehrt je Szenario die Lagedaten-Herkunft (R-01)', () => {
    for (const s of ladeSzenarien()) {
      expect(['synthetisch', 'aufgezeichnet']).toContain(s.lagedaten_herkunft);
    }
  });
});
