/**
 * `Number('')` ist 0 — ein geleertes Faktorfeld meldete deshalb eine erfundene Null, die
 * der Kern anschliessend gewichtet. Genau der Fall, fuer den `entscheideZellenwert`
 * geschrieben wurde; die Lehre stand bisher nur in `zellen-logik.ts`/`ZellenEingabe.tsx`.
 *
 * Handler werden ueber gemockte Primitive abgefangen und direkt aufgerufen (Vorgehen wie
 * in `AnpassungsSpalten.test.tsx`) — das Repo fuehrt kein jsdom.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Faktorformular } from '../../../src/server/faktorformular.js';

interface ErfasstesFeld {
  readonly value: unknown;
  readonly onChange: (e: { target: { value: string } }) => void;
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

import { Aufwandfaktoren } from '../../../src/components/projekt/Aufwandfaktoren.js';

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

describe('Aufwandfaktoren — ein geleertes Feld erfindet keine Null', () => {
  it('meldet einen gueltigen Zahlenentwurf', () => {
    const aendere = vi.fn();
    zeichne({ f_zahl: 5 }, aendere);
    erfasst.inputs[0]!.onChange({ target: { value: '7' } });
    expect(aendere).toHaveBeenCalledWith({ f_zahl: 7 });
  });

  it('meldet ein geleertes Zahlfeld gar nicht, statt eine 0 zu melden', () => {
    const aendere = vi.fn();
    zeichne({ f_zahl: 5 }, aendere);
    erfasst.inputs[0]!.onChange({ target: { value: '' } });
    expect(aendere).not.toHaveBeenCalled();
  });

  it('meldet einen nicht parsierbaren Entwurf gar nicht', () => {
    const aendere = vi.fn();
    zeichne({ f_zahl: 5 }, aendere);
    erfasst.inputs[0]!.onChange({ target: { value: '-' } });
    erfasst.inputs[0]!.onChange({ target: { value: '3,5' } });
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
