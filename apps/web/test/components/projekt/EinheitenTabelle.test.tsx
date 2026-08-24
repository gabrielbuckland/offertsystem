import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EinheitenTabelle } from '../../../src/components/projekt/EinheitenTabelle.js';

const SPALTEN = [
  { id: 'S-1', bezeichnung: 'Zuschlag Etage', erfassungsform: 'relativ' as const, vorgabewert: 0 },
  { id: 'S-2', bezeichnung: 'Aussicht', erfassungsform: 'absolut' as const, vorgabewert: 0 },
];
const REFS = [{
  id: 'R-1', zimmerzahl: 3.5,
  parametrisierung: {
    flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
    zustandsbewertungen: {}, qualitaetsbewertungen: {},
    anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
  },
}];
const EINHEITEN = [{
  id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
  flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1,
  spaltenwerte: {}, manuelleAnpassungen: [],
}];

describe('EinheitenTabelle', () => {
  it('fuehrt je konfigurierter Spalte eine Tabellenspalte', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS}
                        preise={{}} aendere={() => undefined} />);
    expect(html).toContain('Zuschlag Etage');
    expect(html).toContain('Aussicht');
  });

  it('zeigt den berechneten Preis, sobald er vorliegt', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS}
                        preise={{ 'E-1': { basispreis: 100_000_00, preis: 105_000_00 } }}
                        aendere={() => undefined} />);
    expect(html).toContain('105');
  });

  it('weist einen noch nicht berechneten Preis aus, statt null zu zeigen', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS}
                        preise={{}} aendere={() => undefined} />);
    expect(html).toContain('—');
  });

  it('zeigt die Anzahl erfasster manueller Positionen je Einheit', () => {
    const mitPositionen = [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, spaltenwerte: {},
      manuelleAnpassungen: [
        { erfassungsform: 'absolut' as const, wert: 5000, begruendung: 'Balkonlage' },
        { erfassungsform: 'relativ' as const, wert: -0.02, begruendung: 'Lärmimmission' },
      ],
    }];
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={mitPositionen} spalten={SPALTEN} referenzobjekte={REFS}
                        preise={{}} aendere={() => undefined} />);
    expect(html).toContain('Balkonlage');
    expect(html).toContain('Lärmimmission');
    expect(html).toContain('2 Positionen');
  });

  it('bietet je Einheit ein Formular, um eine manuelle Position mit Begruendung zu erfassen',
    () => {
      const html = renderToStaticMarkup(
        <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS}
                          preise={{}} aendere={() => undefined} />);
      expect(html).toContain('Begründung');
      expect(html).toContain('Position hinzufügen');
    });
});
