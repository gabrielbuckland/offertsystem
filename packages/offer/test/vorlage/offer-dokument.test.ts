import { describe, expect, it } from 'vitest';
import { offerSchema } from '../../src/model/offer.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

describe('offerSchema.dokument', () => {
  it('bleibt für bestehende Artefakte ohne Dokument gültig (I-24)', () => {
    expect(() => offerSchema.parse(baueBeispielOfferte())).not.toThrow();
  });

  it('akzeptiert ein aufgelöstes Dokument mit Vorlagenversion und Auftraggeber', () => {
    const offerte = {
      ...baueBeispielOfferte(),
      dokument: {
        inhalt: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Offerte' }] }],
        },
        vorlageVersion: '1',
        auftraggeber: 'Muster Immobilien AG',
      },
    };
    expect(() => offerSchema.parse(offerte)).not.toThrow();
  });

  it('weist ein Dokument mit unaufgelöstem Platzhalter zurück', () => {
    const offerte = {
      ...baueBeispielOfferte(),
      dokument: {
        inhalt: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{ type: 'platzhalter', attrs: { id: 'ort' } }],
          }],
        },
        vorlageVersion: '1',
      },
    };
    expect(offerSchema.safeParse(offerte).success).toBe(false);
  });
});
