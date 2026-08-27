import { describe, expect, it } from 'vitest';
import {
  aufgeloestesDokumentSchema,
  offertDokumentSchema,
  sammlePlatzhalterIds,
} from '../../src/vorlage/dokument-schema.js';

const MINIMAL = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Ausgangslage' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Überbauung in ' },
        { type: 'platzhalter', attrs: { id: 'ort' } },
        { type: 'text', text: '.', marks: [{ type: 'bold' }] },
      ],
    },
    { type: 'platzhalterTabelle' },
    {
      type: 'bulletList',
      content: [{
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punkt' }] }],
      }],
    },
  ],
};

describe('offertDokumentSchema', () => {
  it('akzeptiert die unterstützte Knotenteilmenge', () => {
    expect(offertDokumentSchema.parse(MINIMAL)).toEqual(MINIMAL);
  });

  it('weist unbekannte Knotentypen zurück (Teilmenge, kein Durchreichen)', () => {
    const fremd = { type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] };
    expect(offertDokumentSchema.safeParse(fremd).success).toBe(false);
  });

  it('sammelt Platzhalter-IDs inklusive Tabelle', () => {
    expect(sammlePlatzhalterIds(offertDokumentSchema.parse(MINIMAL)))
      .toEqual(['ort', 'preistabelle']);
  });
});

describe('aufgeloestesDokumentSchema', () => {
  it('kennt keine Platzhalter-Knoten mehr, dafür die Preistabelle', () => {
    const aufgeloest = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Aarau' }] },
        {
          type: 'preistabelle',
          attrs: { zeilen: [{ einheit: 'A-01', flaeche: '86.0 m²', preis: `CHF 500’0000.00` }] },
        },
      ],
    };
    expect(aufgeloestesDokumentSchema.parse(aufgeloest)).toEqual(aufgeloest);
    expect(aufgeloestesDokumentSchema.safeParse(MINIMAL).success).toBe(false);
  });
});
