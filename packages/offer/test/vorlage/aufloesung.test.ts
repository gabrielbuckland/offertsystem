import { describe, expect, it } from 'vitest';
import { PlatzhalterFehler, loeseDokumentAuf } from '../../src/vorlage/aufloesung.js';
import type { OffertDokument } from '../../src/vorlage/dokument-schema.js';
import type { PlatzhalterWerte } from '../../src/vorlage/platzhalter.js';

const WERTE: PlatzhalterWerte = {
  texte: { ort: 'Aarau', verkaufssumme: `CHF 5'0000000.00` },
  preistabelle: [{ einheit: 'A-01', flaeche: '86.0 m²', preis: `CHF 500'0000.00` }],
};

function absatzMit(...inline: object[]): OffertDokument {
  return { type: 'doc', content: [{ type: 'paragraph', content: inline }] } as OffertDokument;
}

describe('loeseDokumentAuf', () => {
  it('ersetzt Platzhalter durch Textknoten und erhält Nachbartext samt Marks', () => {
    const dokument = absatzMit(
      { type: 'text', text: 'Standort ', marks: [{ type: 'bold' }] },
      { type: 'platzhalter', attrs: { id: 'ort' } },
      { type: 'text', text: '.' },
    );
    expect(loeseDokumentAuf(dokument, WERTE)).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Standort ', marks: [{ type: 'bold' }] },
          { type: 'text', text: 'Aarau' },
          { type: 'text', text: '.' },
        ],
      }],
    });
  });

  it('ersetzt die Platzhalter-Tabelle durch die Preistabelle mit Zeilen', () => {
    const dokument: OffertDokument = {
      type: 'doc',
      content: [{ type: 'platzhalterTabelle' }],
    } as OffertDokument;
    expect(loeseDokumentAuf(dokument, WERTE)).toEqual({
      type: 'doc',
      content: [{ type: 'preistabelle', attrs: { zeilen: WERTE.preistabelle } }],
    });
  });

  it('wirft bei unbekannter Platzhalter-ID mit Grund "unbekannt"', () => {
    const dokument = absatzMit({ type: 'platzhalter', attrs: { id: 'kaufpreis' } });
    expect(() => loeseDokumentAuf(dokument, WERTE)).toThrowError(PlatzhalterFehler);
    try { loeseDokumentAuf(dokument, WERTE); } catch (f) {
      expect((f as PlatzhalterFehler).id).toBe('kaufpreis');
      expect((f as PlatzhalterFehler).grund).toBe('unbekannt');
    }
  });

  it('wirft bei bekanntem Platzhalter ohne Wert mit Grund "fehlt" (fail fast)', () => {
    const dokument = absatzMit({ type: 'platzhalter', attrs: { id: 'auftraggeber' } });
    try { loeseDokumentAuf(dokument, WERTE); throw new Error('kein Fehler'); } catch (f) {
      expect((f as PlatzhalterFehler).id).toBe('auftraggeber');
      expect((f as PlatzhalterFehler).grund).toBe('fehlt');
    }
  });
});
