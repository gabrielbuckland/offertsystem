/**
 * Diese Suite deckt genau die Stelle ab, die Task 9's Review als ungetestet flaggte:
 * die Spaltenentfernung. `renderToStaticMarkup` liefert keine anfassbaren Handler (das
 * Repo hat weder jsdom noch @testing-library/react — siehe repo-fakten.md), darum werden
 * `Button`/`Input` gemockt, um die waehrend eines echten Renderdurchlaufs erzeugten
 * Closures abzufangen und danach direkt aufzurufen ("Handler direkt treiben" statt
 * simulierter Klicks). Das ist ehrlich, weil derselbe Code laeuft wie im echten
 * Renderpfad — nur die DOM-Wiedergabe selbst wird uebersprungen.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { AnpassungsSpalte } from '../../../src/server/projekt-schema.js';

interface ErfassterButton {
  readonly children: unknown;
  readonly onClick: () => void;
  readonly 'aria-label'?: string;
}
interface ErfassterInput {
  readonly value: unknown;
  readonly onChange: (e: { target: { value: string } }) => void;
}
interface ErfassteZelle {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}

const erfasst = vi.hoisted(() => ({
  buttons: [] as ErfassterButton[],
  inputs: [] as ErfassterInput[],
  zellen: [] as ErfassteZelle[],
}));

vi.mock('../../../src/components/ui/button.js', () => ({
  Button: (props: ErfassterButton) => {
    erfasst.buttons.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/ui/input.js', () => ({
  Input: (props: ErfassterInput) => {
    erfasst.inputs.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/ui/select.js', () => ({
  Select: () => null,
}));
vi.mock('../../../src/components/projekt/ZellenEingabe.js', () => ({
  ZellenEingabe: (props: ErfassteZelle) => {
    erfasst.zellen.push(props);
    return null;
  },
}));

import { AnpassungsSpalten, erzeugeSpaltenIdFolge } from '../../../src/components/projekt/AnpassungsSpalten.js';

function spalte(id: string, bezeichnung: string): AnpassungsSpalte {
  return {
    id, bezeichnung, erfassungsform: 'relativ', vorgabewert: 0,
  };
}

describe('AnpassungsSpalten — Entfernen ist ein eigener Rueckruf', () => {
  it('ruft beim Entfernen entferneSpalte mit der Spalten-ID auf, nicht aendere', () => {
    erfasst.buttons.length = 0;
    const aendere = vi.fn();
    const entferneSpalte = vi.fn();
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[spalte('S-1', 'Erste'), spalte('S-2', 'Zweite')]}
        aendere={aendere}
        entferneSpalte={entferneSpalte}
        uebernehmeAufEinheiten={vi.fn()}
      />,
    );

    const entfernenButtons = erfasst.buttons.filter((b) => b['aria-label'] === 'entfernen');
    expect(entfernenButtons).toHaveLength(2);

    entfernenButtons[1]!.onClick();

    expect(entferneSpalte).toHaveBeenCalledTimes(1);
    expect(entferneSpalte).toHaveBeenCalledWith('S-2');
    expect(aendere).not.toHaveBeenCalled();
  });

  it('ruft beim Bearbeiten aendere auf, nicht entferneSpalte', () => {
    erfasst.inputs.length = 0;
    const aendere = vi.fn();
    const entferneSpalte = vi.fn();
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[spalte('S-1', 'Erste')]}
        aendere={aendere}
        entferneSpalte={entferneSpalte}
        uebernehmeAufEinheiten={vi.fn()}
      />,
    );

    const bezeichnungInput = erfasst.inputs[0]!;
    bezeichnungInput.onChange({ target: { value: 'Neu' } });

    expect(aendere).toHaveBeenCalledTimes(1);
    expect(aendere).toHaveBeenCalledWith([spalte('S-1', 'Neu')]);
    expect(entferneSpalte).not.toHaveBeenCalled();
  });
});

describe('AnpassungsSpalten — freigewordene Kennungen werden nicht wiederverwendet', () => {
  it('vergibt bei zwei "Spalte hinzufügen"-Klicks in einer Sitzung verschiedene, neue Kennungen', () => {
    erfasst.buttons.length = 0;
    const aendere = vi.fn();
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[spalte('S-1', 'Erste'), spalte('S-2', 'Zweite')]}
        aendere={aendere}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
      />,
    );

    const hinzufuegenButton = erfasst.buttons.find((b) => b.children === 'Spalte hinzufügen')!;

    hinzufuegenButton.onClick();
    const ersteNeueId = (aendere.mock.calls[0]![0] as readonly AnpassungsSpalte[]).at(-1)!.id;
    hinzufuegenButton.onClick();
    const zweiteNeueId = (aendere.mock.calls[1]![0] as readonly AnpassungsSpalte[]).at(-1)!.id;

    // Eine aus der jeweils AKTUELLEN Liste neu abgeleitete Kennung (der urspruengliche
    // Fehler, siehe Kommentar in AnpassungsSpalten.tsx) haette hier zweimal 'S-3'
    // geliefert, weil beide Klicks von derselben ungeaenderten `spalten`-Prop ausgehen.
    expect(ersteNeueId).not.toBe('S-2');
    expect(zweiteNeueId).not.toBe('S-2');
    expect(zweiteNeueId).not.toBe(ersteNeueId);
  });

  it('erzeugeSpaltenIdFolge leitet die naechste Kennung nie aus einer aktuellen Liste neu ab', () => {
    // Direkter Test der Fabrik selbst: sie kennt nach der Erzeugung nur noch ihren
    // eigenen Zaehler, keine Spaltenliste mehr. Eine gedachte Entfernung von 'S-2' aus
    // der urspruenglichen Liste kann den Zaehler darum nicht auf 'S-2' zuruecksetzen.
    const naechste = erzeugeSpaltenIdFolge([spalte('S-1', 'Erste'), spalte('S-2', 'Zweite')]);
    const ersteZugeteilte = naechste();
    const zweiteZugeteilte = naechste();

    expect(ersteZugeteilte).toBe('S-3');
    expect(ersteZugeteilte).not.toBe('S-2');
    expect(zweiteZugeteilte).not.toBe(ersteZugeteilte);
    expect(zweiteZugeteilte).not.toBe('S-2');
  });
});

/**
 * Der Vorgabewert war ein Bedienelement ohne Wirkung und trug den Einheitenfehler bereits
 * angelegt in sich: erfasst als roher Faktor bzw. als Rappen, waehrend dieselbe Groesse
 * einen Block weiter unten als Prozent bzw. Franken erfasst wird — und ohne Einheit im
 * Kolonnenkopf. Genau die Konstellation, aus der der Faktor-100-Fehler entstanden ist.
 */
describe('AnpassungsSpalten — Vorgabewert in der Einheit des Menschen', () => {
  function mitVorgabewert(
    erfassungsform: AnpassungsSpalte['erfassungsform'], vorgabewert: number,
  ) {
    erfasst.zellen.length = 0;
    const aendere = vi.fn();
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[{
          id: 'S-1', bezeichnung: 'Aussicht', erfassungsform, vorgabewert,
        }]}
        aendere={aendere}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
      />,
    );
    return { aendere, zelle: erfasst.zellen[0]! };
  }

  it('zeigt einen relativen Vorgabewert als Prozentzahl', () => {
    expect(mitVorgabewert('relativ', 0.05).zelle.wert).toBe(5);
  });

  it('speichert eine eingetippte Prozentzahl als Faktor', () => {
    const { aendere, zelle } = mitVorgabewert('relativ', 0);
    zelle.aendere(8);
    expect(aendere).toHaveBeenCalledWith([expect.objectContaining({ vorgabewert: 0.08 })]);
  });

  it('zeigt einen absoluten Vorgabewert in Franken', () => {
    expect(mitVorgabewert('absolut', 250_000).zelle.wert).toBe(2500);
  });

  it('speichert eingetippte Franken als Rappen', () => {
    const { aendere, zelle } = mitVorgabewert('absolut', 0);
    zelle.aendere(2500);
    expect(aendere).toHaveBeenCalledWith([expect.objectContaining({ vorgabewert: 250_000 })]);
  });
});

/**
 * Deckt die Luecke ab, die Task 8's Review fand: `regel` und `vorgabewert` schliessen
 * sich seit Task 3 im Schema aus (`REGEL_UND_VORGABEWERT`). Vor dieser Aenderung bot die
 * Tabelle das Vorgabewert-Feld auch fuer eine Spalte mit Regel an — jede Eingabe darin
 * machte das Projekt unspeicherbar. Erreichbar im normalen Betrieb, weil
 * `config/company-defaults.json` die regelbehaftete Vorlage `stockwerklage` mitbringt.
 */
describe('AnpassungsSpalten — Vorgabewert entfaellt bei einer Spalte mit Regel', () => {
  const spalteMitRegel: AnpassungsSpalte = {
    id: 'S-1',
    bezeichnung: 'Zuschlag Stockwerk',
    erfassungsform: 'absolut',
    regel: { merkmal: 'stockwerk', bereiche: [{ wert: 0 }] },
  };

  it('bietet fuer eine Spalte mit Regel kein Vorgabewert-Eingabefeld an', () => {
    erfasst.zellen.length = 0;
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[spalteMitRegel]}
        aendere={vi.fn()}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
      />,
    );

    expect(erfasst.zellen).toHaveLength(0);
  });

  it('bietet fuer eine Spalte ohne Regel weiterhin das Vorgabewert-Eingabefeld an', () => {
    erfasst.zellen.length = 0;
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[spalte('S-1', 'Erste')]}
        aendere={vi.fn()}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
      />,
    );

    expect(erfasst.zellen).toHaveLength(1);
  });
});

describe('AnpassungsSpalten — eine neue Spalte ist sofort speicherbar', () => {
  it('gibt einer neuen Spalte eine Bezeichnung, statt sie leer zu lassen', () => {
    erfasst.buttons.length = 0;
    const aendere = vi.fn();
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[]}
        aendere={aendere}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
      />,
    );

    erfasst.buttons.find((b) => b.children === 'Spalte hinzufügen')!.onClick();

    const neu = (aendere.mock.calls[0]![0] as readonly AnpassungsSpalte[]).at(-1)!;
    // `anpassungsSpalteSchema` verlangt `min(1)`: Eine leere Bezeichnung liess jedes PUT
    // mit 422 scheitern und meldete dem Vermarkter nach JEDEM Hinzufuegen, die Aenderung
    // habe nicht gespeichert werden koennen.
    expect(neu.bezeichnung.trim().length).toBeGreaterThan(0);
  });
});
