import { createElement } from 'react';
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

interface ErfassteZellenEingabe {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}

// Partieller Mock: fängt Props ab, rendert echte Komponente (sonst useState außerhalb Baum).
const erfassteZellen = vi.hoisted(() => ({ liste: [] as ErfassteZellenEingabe[] }));

vi.mock('../../../src/components/projekt/ZellenEingabe.js', async (importOriginal) => {
  const echte = await importOriginal<typeof import('../../../src/components/projekt/ZellenEingabe.js')>();
  return {
    ...echte,
    ZellenEingabe: (props: ErfassteZellenEingabe) => {
      erfassteZellen.liste.push(props);
      return createElement(echte.ZellenEingabe, props);
    },
  };
});

import { EinheitenTabelle } from '../../../src/components/projekt/EinheitenTabelle.js';
import { BEWERTUNGEN_STANDARD } from '../../bau/bewertungen.js';

const SPALTEN = [
  { id: 'S-1', bezeichnung: 'Zuschlag Etage', erfassungsform: 'relativ' as const, vorgabewert: 0 },
  { id: 'S-2', bezeichnung: 'Aussicht', erfassungsform: 'absolut' as const, vorgabewert: 0 },
];
const REFS = [{
  id: 'R-1', zimmerzahl: 3.5,
  parametrisierung: {
    flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'minergie_p' as const,
    ...BEWERTUNGEN_STANDARD,
    anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump_air' as const,
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

  it('zeigt den aus der Regel abgeleiteten Wert, ohne dass eine Zelle erfasst ist', () => {
    const einheiten = [{ ...EINHEITEN[0]!, merkmalswerte: { stockwerk: 2 } }];
    const html = renderToStaticMarkup(
      <EinheitenTabelle einheiten={einheiten} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                        referenzobjekte={REFS} preise={{}} aendere={() => undefined} />);
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

  // Uebersteuerung ohne Merkmalswert: Regel kann nicht ausgewertet werden, aber Wert gilt.
  it('zeigt bei einer Uebersteuerung ohne Merkmalswert den eingetippten Wert, weder '
    + '"Merkmal fehlt" noch "aus Regel"', () => {
      const einheiten = [{
        ...EINHEITEN[0]!, merkmalswerte: {}, spaltenwerte: { 'S-3': 500000 },
      }];
      const html = renderToStaticMarkup(
        <EinheitenTabelle einheiten={einheiten} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                          referenzobjekte={REFS} preise={{}} aendere={() => undefined} />);
      expect(html).toContain('value="5000"');
      expect(html).not.toContain('Merkmal fehlt');
      expect(html).not.toContain('aus Regel');
      expect(html).not.toContain('übersteuert');
    });

  // Muss Schlüssel entfernen, nicht auf 0 setzen (0 wäre bewusste Übersteuerung, Regel unterdrückt).
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

  // Blur meldet immer. Regelzelle darf nicht stillschweigend übersteuert werden (sonst Regel unterbrochen).
  it('schreibt keine Uebersteuerung, wenn eine regelgetriebene Zelle mit dem angezeigten '
    + 'Regelwert unveraendert verlassen wird', () => {
      const einheiten = [{ ...EINHEITEN[0]!, merkmalswerte: { stockwerk: 2 } }];
      const aendere = vi.fn();
      erfassteZellen.liste.length = 0;
      renderToStaticMarkup(
        <EinheitenTabelle einheiten={einheiten} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                          referenzobjekte={REFS} preise={{}} aendere={aendere} />);

      const zelle = erfassteZellen.liste.find((z) => z.wert === 20000)!;
      zelle.aendere(20000);

      expect(aendere).not.toHaveBeenCalled();
    });

  it('schreibt eine tatsaechlich veraenderte Eingabe einer regelgetriebenen Zelle weiterhin '
    + 'als Uebersteuerung', () => {
      const einheiten = [{ ...EINHEITEN[0]!, merkmalswerte: { stockwerk: 2 } }];
      const aendere = vi.fn();
      erfassteZellen.liste.length = 0;
      renderToStaticMarkup(
        <EinheitenTabelle einheiten={einheiten} spalten={[SPALTE_MIT_REGEL]} merkmale={MERKMALE}
                          referenzobjekte={REFS} preise={{}} aendere={aendere} />);

      const zelle = erfassteZellen.liste.find((z) => z.wert === 20000)!;
      zelle.aendere(15000);

      expect(aendere).toHaveBeenCalledTimes(1);
      const [naechsteEinheiten] = aendere.mock.calls[0]! as [readonly (typeof einheiten[0])[]];
      const naechsteSpaltenwerte = naechsteEinheiten[0]!.spaltenwerte as Record<string, number>;
      expect(naechsteSpaltenwerte['S-3']).toBe(1500000);
    });
});
