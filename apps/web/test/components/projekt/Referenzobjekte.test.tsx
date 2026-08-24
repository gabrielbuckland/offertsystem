/**
 * `renderToStaticMarkup` liefert keine anfassbaren Handler (das Repo hat weder jsdom noch
 * @testing-library/react), darum werden `ZellenEingabe`/`Input` gemockt, um die waehrend
 * eines echten Renderdurchlaufs erzeugten Closures abzufangen und direkt aufzurufen —
 * dasselbe Vorgehen wie in `AnpassungsSpalten.test.tsx`.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Referenzobjekt } from '../../../src/server/projekt-schema.js';

interface ErfassteZelle {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}
interface ErfassterInput {
  readonly value: unknown;
  readonly onChange: (e: { target: { value: string } }) => void;
}
interface ErfassterButton {
  readonly children: unknown;
  readonly onClick: () => void;
}

const erfasst = vi.hoisted(() => ({
  zellen: [] as ErfassteZelle[],
  inputs: [] as ErfassterInput[],
  buttons: [] as ErfassterButton[],
}));

vi.mock('../../../src/components/projekt/ZellenEingabe.js', () => ({
  ZellenEingabe: (props: ErfassteZelle) => {
    erfasst.zellen.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/ui/input.js', () => ({
  Input: (props: ErfassterInput) => {
    erfasst.inputs.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/ui/button.js', () => ({
  Button: (props: ErfassterButton) => {
    erfasst.buttons.push(props);
    return null;
  },
}));

import { Referenzobjekte } from '../../../src/components/projekt/Referenzobjekte.js';

const R: Referenzobjekt = {
  id: 'R1', zimmerzahl: 3.5,
  parametrisierung: {
    flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
    zustandsbewertungen: {}, qualitaetsbewertungen: {},
    anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
  },
};

function zeichne(referenzobjekte: readonly Referenzobjekt[], aendere: (r: readonly Referenzobjekt[]) => void) {
  erfasst.zellen.length = 0;
  erfasst.inputs.length = 0;
  erfasst.buttons.length = 0;
  return renderToStaticMarkup(
    <Referenzobjekte
      referenzobjekte={referenzobjekte}
      aendere={aendere}
      rufeAb={() => undefined}
    />);
}

describe('Referenzobjekte — Anzeige', () => {
  it('weist einen fehlenden Referenzwert als solchen aus', () => {
    const html = zeichne([R], () => undefined);
    expect(html).toContain('nicht bezogen');
  });

  it('zeigt Bewertungsdatum und Konfidenz, wenn ein Wert vorliegt', () => {
    const html = zeichne(
      [{ ...R, bewertung: { wert: 85_000_000, bewertungsdatum: '2026-08-16', konfidenzklasse: 'good' } }],
      () => undefined);
    expect(html).toContain('2026-08-16');
    expect(html).toContain('good');
  });
});

/**
 * Diese Suite haelt die Eigenschaft fest, ohne die das Mehrtypenmodell durch die
 * Oberflaeche unerreichbar bleibt: Die typbestimmenden Merkmale muessen editierbar sein,
 * und ein zweites Referenzobjekt darf nicht mit der Zimmerzahl des ersten kollidieren
 * (ZIMMERZAHL_MEHRFACH, `packages/core/src/domain/liegenschaft.ts`).
 */
describe('Referenzobjekte — typbestimmende Merkmale sind editierbar', () => {
  it('bindet Zimmerzahl, beide Flaechen und das Stockwerk als Zahleneingaben', () => {
    zeichne([R], () => undefined);
    expect(erfasst.zellen.map((z) => z.wert)).toEqual([3.5, 86, 19, 1]);
  });

  it('meldet eine geaenderte Zimmerzahl als vollstaendige Liste', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.zellen[0]!.aendere(4.5);
    expect(aendere).toHaveBeenCalledWith([{ ...R, zimmerzahl: 4.5 }]);
  });

  it('meldet eine geaenderte Wohnflaeche in der Parametrisierung', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.zellen[1]!.aendere(92);
    expect(aendere).toHaveBeenCalledWith(
      [{ ...R, parametrisierung: { ...R.parametrisierung, flaecheInnen: 92 } }]);
  });

  it('meldet ein geaendertes Energielabel', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.inputs[0]!.onChange({ target: { value: 'A' } });
    expect(aendere).toHaveBeenCalledWith(
      [{ ...R, parametrisierung: { ...R.parametrisierung, energielabel: 'A' } }]);
  });

  it('aendert nur die angefasste Zeile, die uebrigen bleiben referenzgleich', () => {
    const zweites: Referenzobjekt = { ...R, id: 'R2', zimmerzahl: 4.5 };
    const aendere = vi.fn();
    zeichne([R, zweites], aendere);
    erfasst.zellen[4]!.aendere(5.5);
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(neu[0]).toBe(R);
    expect(neu[1]!.zimmerzahl).toBe(5.5);
  });
});

describe('Referenzobjekte — ein zweites Objekt ist ohne Nacharbeit gueltig', () => {
  it('vergibt einem neuen Referenzobjekt eine noch nicht belegte Zimmerzahl', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.buttons.find((b) => b.children === 'Referenzobjekt hinzufügen')!.onClick();
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(neu).toHaveLength(2);
    // Ein festes `1` kollidierte hier nicht, wohl aber beim naechsten Objekt — die
    // Fortschreibung haelt die Zimmerzahlen ueber beliebig viele Objekte verschieden.
    expect(new Set(neu.map((r) => r.zimmerzahl)).size).toBe(2);
    expect(neu[1]!.id).toBe('R2');
  });

  it('kollidiert auch beim dritten Objekt nicht', () => {
    const zwei = [R, { ...R, id: 'R2', zimmerzahl: 4 }];
    const aendere = vi.fn();
    zeichne(zwei, aendere);
    erfasst.buttons.find((b) => b.children === 'Referenzobjekt hinzufügen')!.onClick();
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(new Set(neu.map((r) => r.zimmerzahl)).size).toBe(3);
  });
});
