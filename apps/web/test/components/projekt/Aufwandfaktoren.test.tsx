/**
 * `Number('')` ist 0 — ein geleertes Faktorfeld meldete deshalb eine erfundene Null, die
 * der Kern anschliessend gewichtet. `ZahlFeld` folgt deshalb dem Muster: lokaler Entwurf,
 * Meldung erst bei `onBlur`.
 *
 * Handler werden ueber gemockte Primitive abgefangen und direkt aufgerufen — das Repo
 * fuehrt kein jsdom. Ein simulierter Tastendruck aendert dabei die eingefangene Closure
 * nicht (kein echter Re-Render), darum wird der Entwurfszustand ueber die initiale
 * `werte`-Prop gesetzt, siehe Kommentar unten.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Faktorformular } from '../../../src/server/faktorformular.js';

interface ErfasstesFeld {
  readonly value: unknown;
  readonly onChange: (e: { target: { value: string } }) => void;
  readonly onBlur?: () => void;
}

const erfasst = vi.hoisted(() => ({
  inputs: [] as ErfasstesFeld[],
  selects: [] as ErfasstesFeld[],
}));

vi.mock('../../../src/components/ui/input.js', () => ({
  Input: (props: ErfasstesFeld) => {
    erfasst.inputs.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/ui/select.js', () => ({
  Select: (props: ErfasstesFeld) => {
    erfasst.selects.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/ui/label.js', () => ({ Label: () => null }));

import {
  Aufwandfaktoren, entscheideZahlfeldCommit,
} from '../../../src/components/projekt/Aufwandfaktoren.js';

const FORMULAR = {
  felder: [
    { faktorId: 'f_zahl', beschriftung: 'Zahlfeld', eingabeform: 'zahl', untergrenze: 0, obergrenze: 10 },
    {
      faktorId: 'f_ordinal', beschriftung: 'Ordinalfeld', eingabeform: 'ordinal',
      stufen: [{ wert: 1, bezeichnung: 'tief' }, { wert: 3, bezeichnung: 'hoch' }],
    },
  ],
  anzeigeFaktoren: [],
} as unknown as Faktorformular;

function zeichne(werte: Readonly<Record<string, number>>, aendere: (w: Readonly<Record<string, number>>) => void) {
  erfasst.inputs.length = 0;
  erfasst.selects.length = 0;
  renderToStaticMarkup(<Aufwandfaktoren formular={FORMULAR} werte={werte} aendere={aendere} />);
}

/*
 * `entscheideZahlfeldCommit` ist die aus `ZahlFeld` herausgeloeste Commit-Entscheidung:
 * Anders als die Handler-Tests unten kann diese Suite die eigentliche onChange->onBlur-
 * Verknuepfung direkt beweisen — ein getippter Wert wird beim Verlassen genau der Wert,
 * der committet wird —, weil sie keinen React-Render braucht.
 */
describe('entscheideZahlfeldCommit', () => {
  it('committet einen getippten, gueltigen Wert', () => {
    expect(entscheideZahlfeldCommit('7', 5)).toEqual({ art: 'uebernehmen', wert: 7 });
  });

  it('faellt bei leerem Entwurf auf den aktuellen Wert zurueck, statt eine 0 zu erfinden', () => {
    expect(entscheideZahlfeldCommit('', 5)).toEqual({ art: 'beibehalten', wert: 5 });
  });

  it('faellt bei nicht parsierbarem Entwurf auf den aktuellen (moeglicherweise fehlenden) Wert zurueck', () => {
    expect(entscheideZahlfeldCommit('-', undefined)).toEqual({ art: 'beibehalten', wert: undefined });
    expect(entscheideZahlfeldCommit('3,5', 5)).toEqual({ art: 'beibehalten', wert: 5 });
  });

  it('committet einen Wert ausserhalb der Feldgrenzen unveraendert — Bereichspruefung ist Sache von pruefeFaktorwerte', () => {
    // Grenzen (untergrenze/obergrenze) sind bewusst kein Parameter der Funktion: das
    // bestehende Verhalten committet einen ausserhalb liegenden, aber parsierbaren Wert
    // unveraendert; erst `pruefeFaktorwerte` markiert ihn danach ueber den `Hinweis`.
    expect(entscheideZahlfeldCommit('999', 5)).toEqual({ art: 'uebernehmen', wert: 999 });
  });
});

describe('Aufwandfaktoren — ein geleertes Feld erfindet keine Null', () => {
  /*
   * Diese Suite prueft nur noch die React-Verdrahtung (onChange haelt lokal, onBlur
   * committet) — die eigentliche Commit-ENTSCHEIDUNG ist oben direkt getestet.
   * `renderToStaticMarkup` rendert einmalig ohne jsdom; ein simulierter Tastendruck
   * aendert die eingefangene Closure nicht (kein echter Re-Render, siehe Dateikopf) —
   * darum wird der Entwurfszustand hier ueber die initiale `werte`-Prop gesetzt statt
   * ueber einen simulierten Tastendruck.
   */
  it('meldet ein fehlendes Zahlfeld beim Verlassen gar nicht, statt eine 0 zu melden', () => {
    const aendere = vi.fn();
    zeichne({}, aendere);
    erfasst.inputs[0]!.onBlur!();
    expect(aendere).not.toHaveBeenCalled();
  });

  it('behandelt das Ordinalfeld nach derselben Regel', () => {
    const aendere = vi.fn();
    zeichne({}, aendere);
    erfasst.selects[0]!.onChange({ target: { value: '' } });
    expect(aendere).not.toHaveBeenCalled();
    erfasst.selects[0]!.onChange({ target: { value: '3' } });
    expect(aendere).toHaveBeenCalledWith({ f_ordinal: 3 });
  });
});
