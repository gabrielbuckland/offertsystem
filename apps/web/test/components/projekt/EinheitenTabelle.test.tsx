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
  spaltenwerte: {}, merkmalswerte: {},
}];
const MERKMALE = [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' as const }];
const SPALTE_MIT_REGEL = {
  id: 'S-3', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut' as const,
  regel: {
    merkmal: 'stockwerk',
    bereiche: [{ unter: 1, wert: 0 }, { unter: 2, wert: 1000000 }, { wert: 2000000 }],
  },
};

describe('EinheitenTabelle', () => {
  it('fuehrt je konfigurierter Spalte eine Tabellenspalte', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS} merkmale={[]}
                        preise={{}} aendere={() => undefined} />);
    expect(html).toContain('Zuschlag Etage');
    expect(html).toContain('Aussicht');
  });

  // Gegenprobe zur Regel eine Zeile darueber: Die Tabelle fuehrt KEIN fest verdrahtetes
  // Merkmal mehr. Die Stockwerklage war genau so eines — ohne Formelwirkung, nur
  // Ablesegrundlage — und ist heute eine konfigurierbare Anpassungsspalte.
  it('fuehrt keine fest verdrahtete Stockwerk-Spalte', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS} merkmale={[]}
                        preise={{}} aendere={() => undefined} />);
    expect(html).not.toContain('Stockwerk');
  });

  it('zeigt den berechneten Preis, sobald er vorliegt', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS} merkmale={[]}
                        preise={{ 'E-1': { basispreis: 100_000_00, preis: 105_000_00 } }}
                        aendere={() => undefined} />);
    expect(html).toContain('105');
  });

  it('weist einen noch nicht berechneten Preis aus, statt null zu zeigen', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} referenzobjekte={REFS} merkmale={[]}
                        preise={{}} aendere={() => undefined} />);
    expect(html).toContain('—');
  });

  it('zeigt einen gespeicherten Faktor einer relativen Spalte als Prozentzahl, nicht als '
    + 'Faktor — sonst waere "5" im Feld ein Faktor von 5 statt 5%', () => {
      const mitFaktor = [{
        id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
        flaecheInnen: 86, flaecheAussen: 19,
        spaltenwerte: { 'S-1': 0.05 }, merkmalswerte: {},
      }];
      const html = renderToStaticMarkup(
        <EinheitenTabelle einheiten={mitFaktor} spalten={SPALTEN} referenzobjekte={REFS} merkmale={[]}
                          preise={{}} aendere={() => undefined} />);
      expect(html).toContain('value="5"');
      expect(html).not.toContain('value="0.05"');
    });

  it('zeigt einen gespeicherten Rappenbetrag einer Franken-Spalte als Frankenbetrag, nicht '
    + 'unskaliert — sonst waeren eingegebene CHF 10\'000 im Kern 100 Rappen = CHF 100', () => {
      const mitRappen = [{
        id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
        flaecheInnen: 86, flaecheAussen: 19,
        spaltenwerte: { 'S-2': 1_000_000 }, merkmalswerte: {},
      }];
      const html = renderToStaticMarkup(
        <EinheitenTabelle einheiten={mitRappen} spalten={SPALTEN} referenzobjekte={REFS} merkmale={[]}
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
      <EinheitenTabelle einheiten={zwei} spalten={SPALTEN} referenzobjekte={REFS} merkmale={[]}
                        preise={{}} aendere={aendere} />);
    erfasst.buttons[1]!.onClick();
    expect(aendere).toHaveBeenCalledWith([zwei[0]]);
  });

  it('fuehrt je konfiguriertem Merkmal eine Tabellenspalte', () => {
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={EINHEITEN} spalten={SPALTEN} merkmale={MERKMALE}
                        referenzobjekte={REFS} preise={{}} aendere={() => undefined} />);
    expect(html).toContain('Stockwerk');
  });

  it('zeigt den aus der Regel abgeleiteten Wert, ohne dass eine Zelle erfasst ist', () => {
    const einheiten = [{ ...EINHEITEN[0]!, merkmalswerte: { stockwerk: 2 } }];
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={einheiten} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                        referenzobjekte={REFS} preise={{}} aendere={() => undefined} />);
    // 2'000'000 Rappen -> 20'000 Franken (rappenZuFranken), unformatiert wie `ZellenEingabe`
    // jeden Zellwert ausgibt (`String(wert)`, kein Tausendertrennzeichen).
    expect(html).toContain('20000');
    expect(html).toContain('aus Regel');
  });

  it('weist eine Uebersteuerung als solche aus', () => {
    const einheiten = [{
      ...EINHEITEN[0]!, merkmalswerte: { stockwerk: 2 }, spaltenwerte: { 'S-3': 500000 },
    }];
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={einheiten} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                        referenzobjekte={REFS} preise={{}} aendere={() => undefined} />);
    expect(html).toContain('übersteuert');
  });

  // Der Fall, den `ermittleWirksamenWert` seit Task 5 eigens ausweist: eine Uebersteuerung
  // auf einer Regel-Spalte, deren Merkmal an dieser Einheit gar keinen Wert fuehrt. Die
  // Regel kann dann gar nicht ausgewertet werden — `wirksam.regel` bleibt undefiniert —,
  // trotzdem gilt der eingetippte Wert. Ohne diesen Test koennte ein spaeterer Zugriff
  // wie `wirksam.regel!.regelwert` unbedingt geschrieben werden und liefe hier ins Leere.
  it('zeigt bei einer Uebersteuerung ohne Merkmalswert den eingetippten Wert, weder '
    + '"Merkmal fehlt" noch "aus Regel"', () => {
      const einheiten = [{
        ...EINHEITEN[0]!, merkmalswerte: {}, spaltenwerte: { 'S-3': 500000 },
      }];
      const html = renderToStaticMarkup(
        <EinheitenTabelle einheiten={einheiten} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                          referenzobjekte={REFS} preise={{}} aendere={() => undefined} />);
      // 500'000 Rappen -> 5'000 Franken (rappenZuFranken), unformatiert wie `ZellenEingabe`
      // jeden Zellwert ausgibt.
      expect(html).toContain('value="5000"');
      expect(html).not.toContain('Merkmal fehlt');
      expect(html).not.toContain('aus Regel');
      expect(html).not.toContain('übersteuert');
    });

  // Die Spec verlangt "Zuruecksetzen stellt den Regelwert wieder her" — das gilt nur,
  // weil der Rueckruf den SCHLUESSEL aus `spaltenwerte` entfernt statt ihn auf 0 zu
  // setzen (eine erfasste 0 waere eine bewusste Uebersteuerung, die die Regel weiterhin
  // unterdrueckt). `toHaveProperty`/`=== undefined` uebersaehe eine Regression zu
  // `{ ...spaltenwerte, [id]: undefined }` (der Schluessel waere weiterhin vorhanden,
  // nur sein Wert waere `undefined`) — deshalb hier explizit ueber die Schluesselliste.
  it('entfernt beim Zuruecksetzen den Schluessel aus spaltenwerte, statt ihn auf 0 zu setzen', () => {
    const einheit = {
      ...EINHEITEN[0]!, merkmalswerte: { stockwerk: 2 }, spaltenwerte: { 'S-3': 500000 },
    };
    const aendere = vi.fn();
    erfasst.buttons.length = 0;
    renderToStaticMarkup(
      <EinheitenTabelle einheiten={[einheit]} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                        referenzobjekte={REFS} preise={{}} aendere={aendere} />);

    const zuruecksetzenButton = erfasst.buttons.find((b) => b.children === 'zurücksetzen')!;
    zuruecksetzenButton.onClick();

    expect(aendere).toHaveBeenCalledTimes(1);
    const [naechsteEinheiten] = aendere.mock.calls[0]! as [readonly typeof einheit[]];
    const naechsteSpaltenwerte = naechsteEinheiten[0]!.spaltenwerte;
    expect(Object.prototype.hasOwnProperty.call(naechsteSpaltenwerte, 'S-3')).toBe(false);
  });
});
