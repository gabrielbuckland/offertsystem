/**
 * `renderToStaticMarkup` haengt keine Handler an (kein jsdom/@testing-library im Repo,
 * siehe `AnpassungsSpalten.test.tsx`) — deshalb werden `Button`/`Input` gemockt, um die
 * waehrend eines echten Renderdurchlaufs erzeugten Closures abzufangen und danach direkt
 * aufzurufen ("Handler direkt treiben" statt simulierter Klicks). Derselbe Code laeuft
 * wie im echten Renderpfad, nur die DOM-Wiedergabe selbst wird uebersprungen.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { Merkmal } from '@offert/core';

interface ErfassterButton {
  readonly children: unknown;
  readonly onClick: () => void;
  readonly 'aria-label'?: string;
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

import { ableiteMerkmalId, MerkmalEditor } from '../../../src/components/einstellungen/MerkmalEditor.js';

function merkmal(id: string, bezeichnung: string): Merkmal {
  return { id, bezeichnung, form: 'zahl' };
}

describe('MerkmalEditor — Merkmal hinzufuegen', () => {
  it('haengt ein neues Merkmal mit abgeleiteter Kennung an, statt die Liste zu ersetzen', () => {
    erfasst.buttons.length = 0;
    const aendere = vi.fn();
    renderToStaticMarkup(
      <MerkmalEditor merkmale={[merkmal('stockwerk', 'Stockwerk')]} aendere={aendere} />,
    );

    erfasst.buttons.find((b) => b.children === 'Merkmal hinzufügen')!.onClick();

    expect(aendere).toHaveBeenCalledTimes(1);
    const naechste = aendere.mock.calls[0]![0] as readonly Merkmal[];
    expect(naechste).toHaveLength(2);
    expect(naechste[0]).toEqual(merkmal('stockwerk', 'Stockwerk'));
    expect(naechste[1]).toEqual({ id: ableiteMerkmalId('merkmal 2'), bezeichnung: 'Neues Merkmal', form: 'zahl' });
  });
});

describe('MerkmalEditor — Bezeichnung bearbeiten', () => {
  it('aendert nur die Bezeichnung der bearbeiteten Zeile, die Kennung bleibt unveraendert', () => {
    erfasst.inputs.length = 0;
    const aendere = vi.fn();
    renderToStaticMarkup(
      <MerkmalEditor
        merkmale={[merkmal('stockwerk', 'Stockwerk'), merkmal('flaeche', 'Fläche')]}
        aendere={aendere}
      />,
    );

    // Zweites Merkmal ist die zweite Bezeichnungs-Zeile.
    erfasst.inputs[1]!.onChange({ target: { value: 'Wohnflaeche' } });

    expect(aendere).toHaveBeenCalledWith([
      merkmal('stockwerk', 'Stockwerk'),
      merkmal('flaeche', 'Wohnflaeche'),
    ]);
  });
});

describe('MerkmalEditor — Merkmal entfernen', () => {
  it('entfernt genau das angeklickte Merkmal und laesst die uebrigen unveraendert', () => {
    erfasst.buttons.length = 0;
    const aendere = vi.fn();
    renderToStaticMarkup(
      <MerkmalEditor
        merkmale={[merkmal('stockwerk', 'Stockwerk'), merkmal('flaeche', 'Fläche')]}
        aendere={aendere}
      />,
    );

    const entfernenButtons = erfasst.buttons.filter((b) => b['aria-label'] === 'entfernen');
    expect(entfernenButtons).toHaveLength(2);
    entfernenButtons[0]!.onClick();

    expect(aendere).toHaveBeenCalledWith([merkmal('flaeche', 'Fläche')]);
  });
});

describe('ableiteMerkmalId', () => {
  it('leitet aus einer normalen Bezeichnung eine kleingeschriebene Kennung ab', () => {
    expect(ableiteMerkmalId('Stockwerk')).toBe('stockwerk');
  });

  it('ersetzt Umlaute durch ihre Digraph-Schreibweise statt sie zu verschlucken', () => {
    // `BEZEICHNER_MUSTER` (Kern) laesst nur [a-zA-Z0-9_] zu — ein blosses Entfernen des
    // Umlauts liesse aus "Grösse" das irrefuehrende "grsse" werden.
    expect(ableiteMerkmalId('Grösse')).toBe('groesse');
  });

  it('stellt bei einer mit Ziffer beginnenden Bezeichnung ein "m_" voran', () => {
    // `BEZEICHNER_MUSTER` verlangt `^[a-z]` am Anfang — eine mit Ziffer beginnende
    // Kennung waere sonst serverseitig ungueltig und faellt erst beim Speichern auf.
    expect(ableiteMerkmalId('2 Zimmer')).toBe('m_2_zimmer');
  });
});
