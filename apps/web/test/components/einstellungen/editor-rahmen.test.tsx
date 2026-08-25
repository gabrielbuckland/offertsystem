import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { befundeFuerPfad } from '../../../src/components/einstellungen/verwende-einstellungen.js';
import { EinstellungsEditor } from '../../../src/components/einstellungen/EinstellungsEditor.js';

describe('befundeFuerPfad', () => {
  it('liefert nur die Befunde unterhalb des uebergebenen Praefixes', () => {
    const befunde = [
      { pfad: 'honorar.stuetzstellen[1].hMin', text: 'Degression verletzt.' },
      { pfad: 'flaeche.alpha', text: 'Ausserhalb des Wertebereichs.' },
    ];
    expect(befundeFuerPfad(befunde, 'honorar')).toEqual([befunde[0]]);
  });

  it('laesst einen unanhaengigen Befund (leerer Pfad) unabhaengig vom Praefix durch', () => {
    // pfad: '' ist der Netz-/500-Fallback aus verwendeEinstellungen — er hat keinen
    // genaueren Ort im Formular und muss deshalb bei JEDEM Bereich auftauchen koennen,
    // dessen Editor gerade den gescheiterten Speicherversuch ausgeloest hat.
    const befunde = [{ pfad: '', text: 'Die Einstellungen konnten nicht gespeichert werden.' }];
    expect(befundeFuerPfad(befunde, 'honorar')).toEqual(befunde);
  });
});

describe('EinstellungsEditor', () => {
  it('zeigt den Wirkungshinweis und die Speichern-Schaltflaeche im statischen Markup', () => {
    const html = renderToStaticMarkup(
      <EinstellungsEditor
        titel="Honorar"
        zweck="Testzweck fuer die Rahmenpruefung."
        bereichPraefix="honorar"
        anfang={{}}
      />,
    );
    expect(html).toContain('Wirkt auf alle Projekte.');
    expect(html).toContain('Speichern');
    expect(html).toContain('Verwerfen');
  });

  it('ruft den uebergebenen Editor mit dem lebenden Zustand auf (typgeprueft statt injiziert)', () => {
    const html = renderToStaticMarkup(
      <EinstellungsEditor
        titel="Honorar"
        zweck="Testzweck fuer die Rahmenpruefung."
        bereichPraefix="honorar"
        anfang={{ honorar: 'wert' }}
        Editor={({ einstellungen }) => (
          <p data-testid="editor-inhalt">{String(einstellungen.entwurf['honorar'])}</p>
        )}
      />,
    );
    expect(html).toContain('data-testid="editor-inhalt"');
    expect(html).toContain('wert');
  });
});
