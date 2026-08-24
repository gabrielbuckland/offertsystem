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
}
interface ErfassterInput {
  readonly value: unknown;
  readonly onChange: (e: { target: { value: string } }) => void;
}

const erfasst = vi.hoisted(() => ({
  buttons: [] as ErfassterButton[],
  inputs: [] as ErfassterInput[],
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
      />,
    );

    const entfernenButtons = erfasst.buttons.filter((b) => b.children === 'entfernen');
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
