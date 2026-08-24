import { describe, expect, it } from 'vitest';
import { standardKonfiguration } from '../bau/offerte-bauer.js';
import { vorbelegteSpalten } from '../../src/server/spalten-vorbelegung.js';

describe('vorbelegteSpalten', () => {
  it('erzeugt je firmenweiter Vorlage eine Spalte', () => {
    const spalten = vorbelegteSpalten(standardKonfiguration());
    expect(spalten.length).toBeGreaterThan(0);
    for (const s of spalten) {
      expect(s.bezeichnung).not.toBe('');
      expect(s.erfassungsform).toBe('relativ');
    }
  });

  it('vergibt eindeutige Spaltenkennungen', () => {
    const ids = vorbelegteSpalten(standardKonfiguration()).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uebernimmt den Vorgabefaktor der Vorlage als Vorgabewert', () => {
    const spalten = vorbelegteSpalten(standardKonfiguration());
    expect(spalten.every((s) => Number.isFinite(s.vorgabewert))).toBe(true);
  });
});
