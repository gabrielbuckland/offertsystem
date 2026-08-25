/**
 * `renderToStaticMarkup` liefert keine anfassbaren Handler (kein jsdom im Repo) — dieser
 * Test prueft deshalb nur das gerenderte Markup: die acht Skalarfelder mit Beschriftung,
 * die Herkunftsauszeichnung (Spec §5) sowie die beiden Bewertungs-Records als
 * Schluessel-Wert-Zeilen mit «Eintrag hinzufügen».
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DossierDefaults } from '@offert/core';
import type { Referenzobjekt } from '../../../src/server/projekt-schema.js';
import { ParametrisierungsDetail } from '../../../src/components/projekt/ParametrisierungsDetail.js';

const parametrisierung: Referenzobjekt['parametrisierung'] = {
  flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
  zustandsbewertungen: { keller: 'gut' }, qualitaetsbewertungen: {},
  anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
};

// `flaecheInnen` stimmt mit dem firmenweiten Wert ueberein (firmenweit), die uebrigen
// sieben Skalarfelder weichen ab bzw. haben gar keinen firmenweiten Default
// (projektbezogen) — vier der zehn Felder fuehren dossierDefaults ueberhaupt nicht.
const dossierDefaults: DossierDefaults = {
  flaecheInnen: 86, flaecheAussen: null, stockwerk: null, energielabel: null,
  zustandsbewertungen: {}, qualitaetsbewertungen: {},
};

function zeichne() {
  return renderToStaticMarkup(
    <ParametrisierungsDetail
      parametrisierung={parametrisierung}
      dossierDefaults={dossierDefaults}
      aendere={() => undefined}
    />);
}

describe('ParametrisierungsDetail', () => {
  it('beschriftet alle acht Skalarfelder', () => {
    const html = zeichne();
    for (const beschriftung of [
      'Wohnfläche', 'Aussenfläche', 'Stockwerk', 'Energielabel',
      'Anzahl Badezimmer', 'Lift', 'Baujahr', 'Heizungsart',
    ]) {
      expect(html).toContain(beschriftung);
    }
  });

  it('kennzeichnet ein deckungsgleiches Feld als firmenweit, ein abweichendes als '
    + 'projektbezogen — vier Felder haben gar keinen firmenweiten Default', () => {
    const html = zeichne();
    expect(html.match(/firmenweit/g)).toHaveLength(1);
    expect(html.match(/projektbezogen/g)).toHaveLength(7);
  });

  it('rendert beide Bewertungs-Records als Schluessel-Wert-Zeilen mit '
    + '«Eintrag hinzufügen»', () => {
    const html = zeichne();
    expect(html).toContain('keller');
    expect(html).toContain('gut');
    expect(html.match(/Eintrag hinzufügen/g)).toHaveLength(2);
  });
});
