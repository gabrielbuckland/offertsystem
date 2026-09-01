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
interface ErfassterSelect {
  readonly children: unknown;
  readonly value: unknown;
  readonly onChange: (e: { target: { value: string } }) => void;
  readonly 'aria-label'?: string;
}
interface ErfassteZelle {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}

const erfasst = vi.hoisted(() => ({
  buttons: [] as ErfassterButton[],
  inputs: [] as ErfassterInput[],
  selects: [] as ErfassterSelect[],
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
  Select: (props: ErfassterSelect) => {
    erfasst.selects.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/projekt/ZellenEingabe.js', () => ({
  ZellenEingabe: (props: ErfassteZelle) => {
    erfasst.zellen.push(props);
    return null;
  },
}));

import {
  AnpassungsSpalten, beschreibeStaffel, erzeugeSpaltenIdFolge,
  spalteMitGeaenderterRegel, spalteMitRegel, spalteOhneRegel,
} from '../../../src/components/projekt/AnpassungsSpalten.js';

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
        merkmale={[]}
        spalten={[spalte('S-1', 'Erste'), spalte('S-2', 'Zweite')]}
        aendere={aendere}
        entferneSpalte={entferneSpalte}
        uebernehmeAufEinheiten={vi.fn()}
        vorlagen={[]}
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
        merkmale={[]}
        spalten={[spalte('S-1', 'Erste')]}
        aendere={aendere}
        entferneSpalte={entferneSpalte}
        uebernehmeAufEinheiten={vi.fn()}
        vorlagen={[]}
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
        merkmale={[]}
        spalten={[spalte('S-1', 'Erste'), spalte('S-2', 'Zweite')]}
        aendere={aendere}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
        vorlagen={[]}
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
        merkmale={[]}
        spalten={[{
          id: 'S-1', bezeichnung: 'Aussicht', erfassungsform, vorgabewert,
        }]}
        aendere={aendere}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
        vorlagen={[]}
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
        merkmale={[]}
        spalten={[spalteMitRegel]}
        aendere={vi.fn()}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
        vorlagen={[]}
      />,
    );

    expect(erfasst.zellen).toHaveLength(0);
  });

  it('bietet fuer eine Spalte ohne Regel weiterhin das Vorgabewert-Eingabefeld an', () => {
    erfasst.zellen.length = 0;
    renderToStaticMarkup(
      <AnpassungsSpalten
        merkmale={[]}
        spalten={[spalte('S-1', 'Erste')]}
        aendere={vi.fn()}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
        vorlagen={[]}
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
        merkmale={[]}
        spalten={[]}
        aendere={aendere}
        entferneSpalte={vi.fn()}
        uebernehmeAufEinheiten={vi.fn()}
        vorlagen={[]}
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

/**
 * Die Staffel einer Regelspalte muss in der Projektansicht ABLESBAR sein — vorher stand
 * dort nur «Wird von der hinterlegten Regel bestimmt», und welcher Betrag in welchem
 * Segment gilt, war nirgends sichtbar (Rueckmeldung Auftraggeber 2026-08-28).
 */
describe('beschreibeStaffel — weist Segmente und Betraege lesbar aus', () => {
  it('formatiert eine absolute Staffel in Franken mit Merkmalsbezeichnung', () => {
    const s: AnpassungsSpalte = {
      id: 'S-1', bezeichnung: 'Zuschlag Stockwerklage', erfassungsform: 'absolut',
      regel: { merkmal: 'stockwerk', bereiche: [
        { unter: 1, wert: 860000 }, { unter: 2, wert: 0 }, { wert: 1720000 },
      ] },
    };
    const text = beschreibeStaffel(s, [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' }]);
    expect(text).toContain('Stockwerk');
    expect(text).toContain('unter 1');
    expect(text).toContain('sonst');
    // formatiereAggregat formatiert Rappen als Franken (860000 Rp -> CHF 8'600).
    expect(text).toMatch(/8.600/);
    expect(text).toMatch(/17.200/);
  });

  it('formatiert eine relative Staffel in Prozent und faellt ohne Merkmalseintrag auf die Kennung zurueck', () => {
    const s: AnpassungsSpalte = {
      id: 'S-1', bezeichnung: 'Aussicht', erfassungsform: 'relativ',
      regel: { merkmal: 'ausrichtung', bereiche: [{ unter: 1, wert: 0.05 }, { wert: 0 }] },
    };
    const text = beschreibeStaffel(s, []);
    expect(text).toContain('ausrichtung');
    expect(text).toContain('5 %');
  });

  it('liefert fuer eine Spalte ohne Regel einen leeren Text', () => {
    expect(beschreibeStaffel(spalte('S-1', 'Erste'), [])).toBe('');
  });
});

/**
 * Der Umbau Vorgabewert <-> Staffel muss den jeweils anderen Schluessel ENTFERNEN —
 * das Schema schliesst `regel` und `vorgabewert` gegenseitig aus (REGEL_UND_VORGABEWERT),
 * ein zurueckbleibender Schluessel machte jedes PUT des Projekts unspeicherbar.
 */
describe('AnpassungsSpalten — Uebernahme einer firmenweiten Vorlage', () => {
  it('bietet die firmenweiten Vorlagen zur Uebernahme an', () => {
    erfasst.buttons.length = 0;
    erfasst.selects.length = 0;
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[]}
        merkmale={[]}
        vorlagen={[{
          id: 'seesicht',
          bezeichnung: 'Seesicht',
          vorgabefaktor: 0.08,
          erfassungsform: 'relativ',
          begruendungVorschlag: 'Seesicht.',
        }]}
        aendere={() => undefined}
        entferneSpalte={() => undefined}
        uebernehmeAufEinheiten={() => undefined}
      />,
    );

    expect(erfasst.buttons.some((b) => b.children === 'Aus Vorlage')).toBe(true);
    const vorlagenSelect = erfasst.selects.find((s) => s['aria-label'] === 'Vorlage');
    expect(vorlagenSelect).toBeDefined();
    // Button/Select rendern `null` (siehe Mocks oben) — die Optionen selbst sind ungemockt
    // und lassen sich darum separat rendern, um ihren Text zu pruefen.
    const optionenMarkup = renderToStaticMarkup(<>{vorlagenSelect!.children}</>);
    expect(optionenMarkup).toContain('Seesicht');
  });

  it('uebernimmt beim Klick auf "Aus Vorlage" die ausgewaehlte Vorlage mit der naechsten Zaehler-ID', () => {
    erfasst.buttons.length = 0;
    erfasst.selects.length = 0;
    const aendere = vi.fn();
    renderToStaticMarkup(
      <AnpassungsSpalten
        spalten={[spalte('S-2', 'Zweite')]}
        merkmale={[]}
        vorlagen={[{
          id: 'seesicht',
          bezeichnung: 'Seesicht',
          vorgabefaktor: 0.08,
          erfassungsform: 'relativ',
          begruendungVorschlag: 'Seesicht.',
        }]}
        aendere={aendere}
        entferneSpalte={() => undefined}
        uebernehmeAufEinheiten={() => undefined}
      />,
    );

    const vorlagenSelect = erfasst.selects.find((s) => s['aria-label'] === 'Vorlage')!;
    const uebernehmenButton = erfasst.buttons.find((b) => b.children === 'Aus Vorlage')!;

    // Ohne Auswahl: der Klick darf nichts aendern (Guard in uebernimmAusVorlage).
    uebernehmenButton.onClick();
    expect(aendere).not.toHaveBeenCalled();

    vorlagenSelect.onChange({ target: { value: 'seesicht' } });
    uebernehmenButton.onClick();

    expect(aendere).toHaveBeenCalledTimes(1);
    const neueSpalten = aendere.mock.calls[0]![0] as readonly AnpassungsSpalte[];
    expect(neueSpalten).toHaveLength(2);
    const neu = neueSpalten[1]!;
    // ID aus dem laufenden Zaehler (S-2 vorhanden), nie aus Index oder Vorlagen-ID.
    expect(neu.id).toBe('S-3');
    expect(neu.bezeichnung).toBe('Seesicht');
    expect(neu.erfassungsform).toBe('relativ');
    expect(neu.vorgabewert).toBe(0);
    expect('vorgabefaktor' in neu).toBe(false);
    expect('begruendungVorschlag' in neu).toBe(false);
  });
});

describe('Spalten-Umbau Vorgabewert <-> Staffel haelt den Schema-Ausschluss ein', () => {
  it('spalteMitRegel entfernt den Vorgabewert und startet mit totalem Restfall', () => {
    const neu = spalteMitRegel(spalte('S-1', 'Erste'), 'stockwerk');
    expect('vorgabewert' in neu).toBe(false);
    expect(neu.regel).toEqual({ merkmal: 'stockwerk', bereiche: [{ wert: 0 }] });
  });

  it('spalteOhneRegel entfernt die Regel und setzt den Vorgabewert neutral auf 0', () => {
    const mitRegel = spalteMitRegel(spalte('S-1', 'Erste'), 'stockwerk');
    const zurueck = spalteOhneRegel(mitRegel);
    expect('regel' in zurueck).toBe(false);
    expect(zurueck.vorgabewert).toBe(0);
  });

  it('spalteMitGeaenderterRegel kopiert die Bereiche flach in die Schemaform', () => {
    const basis = spalteMitRegel(spalte('S-1', 'Erste'), 'stockwerk');
    const kernRegel = { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 860000 }, { wert: 0 }] };
    const neu = spalteMitGeaenderterRegel(basis, kernRegel);
    expect(neu.regel).toEqual(kernRegel);
    expect(neu.regel!.bereiche[0]).not.toBe(kernRegel.bereiche[0]);
  });
});
