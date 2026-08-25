import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

interface ErfassterButton {
  readonly children: unknown;
  readonly onClick: () => void;
}

const erfasst = vi.hoisted(() => ({ buttons: [] as ErfassterButton[] }));

vi.mock('../../../src/components/ui/button.js', () => ({
  Button: (props: ErfassterButton) => {
    erfasst.buttons.push(props);
    return null;
  },
}));

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
  flaecheInnen: 86, flaecheAussen: 19,
  spaltenwerte: {},
}];

describe('EinheitenTabelle', () => {
  it('fuehrt je konfigurierter Spalte eine Tabellenspalte', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS}
                        preise={{}} aendere={() => undefined} />);
    expect(html).toContain('Zuschlag Etage');
    expect(html).toContain('Aussicht');
  });

  // Gegenprobe zur Regel eine Zeile darueber: Die Tabelle fuehrt KEIN fest verdrahtetes
  // Merkmal mehr. Die Stockwerklage war genau so eines — ohne Formelwirkung, nur
  // Ablesegrundlage — und ist heute eine konfigurierbare Anpassungsspalte.
  it('fuehrt keine fest verdrahtete Stockwerk-Spalte', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS}
                        preise={{}} aendere={() => undefined} />);
    expect(html).not.toContain('Stockwerk');
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

  it('zeigt einen gespeicherten Faktor einer relativen Spalte als Prozentzahl, nicht als '
    + 'Faktor — sonst waere "5" im Feld ein Faktor von 5 statt 5%', () => {
      const mitFaktor = [{
        id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
        flaecheInnen: 86, flaecheAussen: 19,
        spaltenwerte: { 'S-1': 0.05 },
      }];
      const html = renderToStaticMarkup(
        <EinheitenTabelle einheiten={mitFaktor} spalten={SPALTEN} referenzobjekte={REFS}
                          preise={{}} aendere={() => undefined} />);
      expect(html).toContain('value="5"');
      expect(html).not.toContain('value="0.05"');
    });

  it('zeigt einen gespeicherten Rappenbetrag einer Franken-Spalte als Frankenbetrag, nicht '
    + 'unskaliert — sonst waeren eingegebene CHF 10\'000 im Kern 100 Rappen = CHF 100', () => {
      const mitRappen = [{
        id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
        flaecheInnen: 86, flaecheAussen: 19,
        spaltenwerte: { 'S-2': 1_000_000 },
      }];
      const html = renderToStaticMarkup(
        <EinheitenTabelle einheiten={mitRappen} spalten={SPALTEN} referenzobjekte={REFS}
                          preise={{}} aendere={() => undefined} />);
      expect(html).toContain('value="10000"');
      expect(html).not.toContain('value="1000000"');
    });

  it('entfernt genau die angeklickte Einheit', () => {
    const zwei = [
      EINHEITEN[0]!,
      { ...EINHEITEN[0]!, id: 'E-2', wohnungsnummer: 'A-02' },
    ];
    const aendere = vi.fn();
    erfasst.buttons.length = 0;
    renderToStaticMarkup(
      <EinheitenTabelle einheiten={zwei} spalten={SPALTEN} referenzobjekte={REFS}
                        preise={{}} aendere={aendere} />);
    erfasst.buttons[1]!.onClick();
    expect(aendere).toHaveBeenCalledWith([zwei[0]]);
  });
});
