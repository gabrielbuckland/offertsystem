import { describe, expect, it } from 'vitest';
import { PFLICHTARTEFAKTE, meldeFehlend, pruefeSeed, sammle } from './sammler.ts';

describe('sammle', () => {
  it('nennt jedes fehlende Pflichtartefakt einzeln', () => {
    const satz = sammle('/nicht/vorhanden');
    expect([...satz.fehlend].sort()).toEqual([...PFLICHTARTEFAKTE].sort());
    expect(satz.vollstaendig).toBe(false);
  });

  it('nennt in der Abbruchmeldung den Erzeuger, nicht nur den Pfad', () => {
    expect(meldeFehlend(['contract'])).toContain('erzeugt von P3');
  });
});

describe('pruefeSeed', () => {
  it('bricht ab, wenn ein Artefakt ohne Seed vorliegt', () => {
    expect(() => pruefeSeed({ tests: { seed: null } })).toThrow(/seed/i);
    expect(() => pruefeSeed({ tests: { seed: 424242 } })).not.toThrow();
  });
});
