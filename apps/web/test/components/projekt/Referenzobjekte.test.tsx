import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Referenzobjekte } from '../../../src/components/projekt/Referenzobjekte.js';

const R = {
  id: 'R-1', zimmerzahl: 3.5,
  parametrisierung: {
    flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
    zustandsbewertungen: {}, qualitaetsbewertungen: {},
    anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
  },
};

describe('Referenzobjekte', () => {
  it('weist einen fehlenden Referenzwert als solchen aus', () => {
    const html = renderToStaticMarkup(
      <Referenzobjekte referenzobjekte={[R]} aendere={() => undefined} rufeAb={() => undefined} />);
    expect(html).toContain('nicht bezogen');
  });

  it('zeigt Bewertungsdatum und Konfidenz, wenn ein Wert vorliegt', () => {
    const mitWert = {
      ...R,
      bewertung: { wert: 85_000_000, bewertungsdatum: '2026-08-16', konfidenzklasse: 'good' },
    };
    const html = renderToStaticMarkup(
      <Referenzobjekte referenzobjekte={[mitWert]} aendere={() => undefined} rufeAb={() => undefined} />);
    expect(html).toContain('2026-08-16');
    expect(html).toContain('good');
  });
});
