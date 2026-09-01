import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DossierEditor } from '../../../src/components/einstellungen/DossierEditor.js';
import type {
  VerwendeEinstellungenErgebnis,
} from '../../../src/components/einstellungen/verwende-einstellungen.js';

const ENTWURF = {
  dossierDefaults: {
    zustandsbewertungen: {
      bathrooms: 'well_maintained', kitchen: 'well_maintained',
      flooring: 'well_maintained', windows: 'new_or_recently_renovated',
    },
    qualitaetsbewertungen: {
      bathrooms: 'normal', kitchen: 'normal', flooring: 'normal', windows: 'luxury',
    },
  },
};

function zustand(): VerwendeEinstellungenErgebnis {
  return {
    entwurf: ENTWURF, geaendert: false, speichert: false, pruefsumme: undefined,
    befunde: [], aendere: () => undefined, speichere: () => undefined,
    verwerfe: () => undefined,
  };
}

describe('DossierEditor', () => {
  const markup = renderToStaticMarkup(<DossierEditor einstellungen={zustand()} />);

  it('zeigt die vier toten Skalarfelder nicht mehr', () => {
    for (const weg of ['Fläche innen', 'Fläche aussen', 'Stockwerk', 'Energielabel']) {
      expect(markup).not.toContain(weg);
    }
  });

  it('bietet weder Hinzufuegen noch Entfernen — die Feldmenge ist fremdbestimmt', () => {
    expect(markup).not.toContain('Eintrag hinzufügen');
    expect(markup).not.toContain('aria-label="entfernen"');
  });

  it('fuehrt je Objekt genau die vier Anbieterfelder', () => {
    for (const beschriftung of ['Badezimmer', 'Küche', 'Böden', 'Fenster']) {
      // je einmal unter Zustand und einmal unter Qualitaet
      expect(markup.split(beschriftung).length - 1).toBe(2);
    }
  });

  it('waehlt den abgelegten Wert je Zeile aus', () => {
    expect(markup).toContain('value="new_or_recently_renovated"');
    expect(markup).toContain('value="luxury"');
  });
});
