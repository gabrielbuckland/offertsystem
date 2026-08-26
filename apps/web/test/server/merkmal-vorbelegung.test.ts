import { describe, expect, it } from 'vitest';
import { vorbelegteMerkmale } from '../../src/server/merkmal-vorbelegung.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

describe('vorbelegteMerkmale', () => {
  it('uebernimmt die firmenweiten Merkmale unveraendert', () => {
    const merkmale = vorbelegteMerkmale(standardKonfiguration());
    expect(merkmale.map((m) => m.id)).toContain('stockwerk');
  });
});
