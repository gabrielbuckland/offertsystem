import { describe, expect, it } from 'vitest';
import { istGueltigesOffertDokument } from '../../../src/components/offerttext/dokument-pruefung.js';

describe('istGueltigesOffertDokument (C-1)', () => {
  it('akzeptiert ein Dokument innerhalb der Zod-Teilmenge', () => {
    const gueltig = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Text' }] },
        {
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punkt' }] }],
          }],
        },
      ],
    };
    expect(istGueltigesOffertDokument(gueltig)).toBe(true);
  });

  it('weist eine verschachtelte Liste in einem Listenpunkt zurück', () => {
    // `listItem.content` traegt nur `paragraph`, keine verschachtelte Liste.
    const verschachtelt = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Innen' }] }],
            }],
          }],
        }],
      }],
    };
    expect(istGueltigesOffertDokument(verschachtelt)).toBe(false);
  });

  it('weist einen Blockknoten (Preistabelle) in einem Listenpunkt zurück', () => {
    const blockInListe = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'platzhalterTabelle' }] }],
      }],
    };
    expect(istGueltigesOffertDokument(blockInListe)).toBe(false);
  });

  it('weist einen unbekannten Knotentyp zurück', () => {
    expect(istGueltigesOffertDokument({ type: 'doc', content: [{ type: 'image' }] }))
      .toBe(false);
  });

  it('weist Nicht-Objekte zurück, statt zu werfen', () => {
    expect(istGueltigesOffertDokument(undefined)).toBe(false);
    expect(istGueltigesOffertDokument('text')).toBe(false);
  });
});
