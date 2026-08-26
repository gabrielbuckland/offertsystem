/**
 * `renderToStaticMarkup` haengt keine Handler an (kein jsdom/@testing-library im Repo,
 * siehe `AnpassungsSpalten.test.tsx`) — deshalb werden `Button`/`Input`/`Select`/
 * `ZellenEingabe` gemockt, um die waehrend eines echten Renderdurchlaufs erzeugten
 * Closures abzufangen und danach direkt aufzurufen. `MerkmalEditor` und
 * `BereichsregelEditor` sind eigene, getrennt getestete Komponenten (siehe deren eigene
 * Testdateien) — hier interessiert nur, MIT WELCHEN PROPS `PreisanpassungEditor` sie
 * aufruft, nicht ihr eigenes Rendering, darum werden auch sie gemockt.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { Bereichsregel, Merkmal } from '@offert/core';
import type { VerwendeEinstellungenErgebnis } from '../../../src/components/einstellungen/verwende-einstellungen.js';

interface ErfassterButton {
  readonly children: unknown;
  readonly onClick: () => void;
}
interface ErfassterInput {
  readonly type?: string;
  readonly checked?: boolean;
  readonly value?: unknown;
  readonly onChange: (e: { target: { value: string; checked: boolean } }) => void;
}
interface ErfassterSelect {
  readonly value: unknown;
  readonly onChange: (e: { target: { value: string } }) => void;
}
interface ErfassteBereichsregelEditor {
  readonly regel: Bereichsregel;
  readonly merkmale: readonly Merkmal[];
  readonly erfassungsform: 'relativ' | 'absolut';
  readonly aendere: (regel: Bereichsregel) => void;
}

const erfasst = vi.hoisted(() => ({
  buttons: [] as ErfassterButton[],
  inputs: [] as ErfassterInput[],
  selects: [] as ErfassterSelect[],
  bereichsregelEditoren: [] as ErfassteBereichsregelEditor[],
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
  ZellenEingabe: () => null,
}));
vi.mock('../../../src/components/einstellungen/MerkmalEditor.js', () => ({
  MerkmalEditor: () => null,
}));
vi.mock('../../../src/components/einstellungen/BereichsregelEditor.js', () => ({
  BereichsregelEditor: (props: ErfassteBereichsregelEditor) => {
    erfasst.bereichsregelEditoren.push(props);
    return null;
  },
}));

import { PreisanpassungEditor } from '../../../src/components/einstellungen/PreisanpassungEditor.js';

const MERKMALE: readonly Merkmal[] = [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' }];

function vorlage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    bezeichnung: 'Vorlage 1',
    vorgabefaktor: 0.05,
    erfassungsform: 'relativ' as const,
    begruendungVorschlag: 'Standardbegründung',
    ...overrides,
  };
}

function basisEntwurf(vorlagen: readonly unknown[]) {
  return {
    flaeche: { alpha: 0.5 },
    preisanpassung: {
      zMin: -0.2, zMax: 0.2, begruendungPflicht: true, begruendungMinLaenge: 10,
    },
    anpassungsVorlagen: vorlagen,
    merkmale: MERKMALE,
  };
}

function rendere(entwurf: Record<string, unknown>, aendere = vi.fn()): void {
  erfasst.buttons.length = 0;
  erfasst.inputs.length = 0;
  erfasst.selects.length = 0;
  erfasst.bereichsregelEditoren.length = 0;
  const einstellungen: VerwendeEinstellungenErgebnis = {
    entwurf,
    geaendert: false,
    speichert: false,
    pruefsumme: undefined,
    befunde: [],
    aendere,
    speichere: vi.fn(),
    verwerfe: vi.fn(),
  };
  renderToStaticMarkup(<PreisanpassungEditor einstellungen={einstellungen} />);
}

function checkboxen(): readonly ErfassterInput[] {
  return erfasst.inputs.filter((i) => i.type === 'checkbox');
}

describe('PreisanpassungEditor — Regel aktivieren erzwingt vorgabefaktor: 0', () => {
  it('setzt beim Aktivieren vorgabefaktor auf 0 und legt eine minimale, gueltige Regel an', () => {
    // Dies ist die einzige Invariante, die eine gespeicherte Konfiguration vor
    // `CFG_BEREICHSREGEL` («Regel und Vorgabewert nebeneinander») bewahrt — faellt sie
    // einem Refactoring zum Opfer, merkt das niemand, bis ein Vermarkter nicht mehr
    // speichern kann.
    const aendere = vi.fn();
    rendere(basisEntwurf([vorlage({ vorgabefaktor: 0.05 }), vorlage({ id: 'v2' })]), aendere);

    checkboxen()[0]!.onChange({ target: { value: '', checked: true } });

    expect(aendere).toHaveBeenCalledTimes(1);
    const naechstesEntwurf = aendere.mock.calls[0]![0] as { anpassungsVorlagen: readonly Record<string, unknown>[] };
    const erste = naechstesEntwurf.anpassungsVorlagen[0]!;
    expect(erste['vorgabefaktor']).toBe(0);
    expect(erste['regel']).toEqual({ merkmal: 'stockwerk', bereiche: [{ wert: 0 }] });
    // Die zweite Vorlage bleibt unangetastet — die Umschaltung trifft nur den Index,
    // dessen Kontrollkaestchen bedient wurde.
    expect(naechstesEntwurf.anpassungsVorlagen[1]).toEqual(vorlage({ id: 'v2' }));
  });
});

describe('PreisanpassungEditor — Regel deaktivieren', () => {
  it('entfernt beim Deaktivieren das Feld `regel` vollstaendig, statt es auf undefined zu setzen', () => {
    const aendere = vi.fn();
    const mitRegel = vorlage({
      vorgabefaktor: 0,
      regel: { merkmal: 'stockwerk', bereiche: [{ wert: 0 }] },
    });
    rendere(basisEntwurf([mitRegel]), aendere);

    checkboxen()[0]!.onChange({ target: { value: '', checked: false } });

    expect(aendere).toHaveBeenCalledTimes(1);
    const naechstesEntwurf = aendere.mock.calls[0]![0] as { anpassungsVorlagen: readonly Record<string, unknown>[] };
    const erste = naechstesEntwurf.anpassungsVorlagen[0]!;
    // `merge`/`{...v, regel: undefined}` liesse den Schluessel mit dem Wert `undefined`
    // stehen; `JSON.stringify` (der Vergleich in `entwurfGeaendert`) und ein `.strict()`-
    // Zod-Schema behandeln das unterschiedlich von "Schluessel fehlt ganz" — deshalb
    // `hasOwnProperty`, nicht nur ein Wertevergleich.
    expect(Object.prototype.hasOwnProperty.call(erste, 'regel')).toBe(false);
  });
});

describe('PreisanpassungEditor — Erfassungsform', () => {
  it('aendert die Erfassungsform genau der bearbeiteten Vorlage', () => {
    const aendere = vi.fn();
    rendere(basisEntwurf([vorlage({ id: 'v1', erfassungsform: 'relativ' }), vorlage({ id: 'v2' })]), aendere);

    erfasst.selects[0]!.onChange({ target: { value: 'absolut' } });

    expect(aendere).toHaveBeenCalledTimes(1);
    const naechstesEntwurf = aendere.mock.calls[0]![0] as { anpassungsVorlagen: readonly Record<string, unknown>[] };
    expect(naechstesEntwurf.anpassungsVorlagen[0]!['erfassungsform']).toBe('absolut');
    expect(naechstesEntwurf.anpassungsVorlagen[1]!['erfassungsform']).toBe('relativ');
  });
});

describe('PreisanpassungEditor — BereichsregelEditor-Anbindung', () => {
  it('blendet den BereichsregelEditor nur fuer Vorlagen MIT Regel ein und reicht dessen Aenderung zurueck', () => {
    const aendere = vi.fn();
    const regel: Bereichsregel = { merkmal: 'stockwerk', bereiche: [{ wert: 0 }] };
    rendere(basisEntwurf([
      vorlage({ id: 'ohne-regel' }),
      vorlage({ id: 'mit-regel', vorgabefaktor: 0, erfassungsform: 'absolut', regel }),
    ]), aendere);

    // Genau EIN BereichsregelEditor — fuer die Vorlage OHNE Regel wird keiner gerendert.
    expect(erfasst.bereichsregelEditoren).toHaveLength(1);
    expect(erfasst.bereichsregelEditoren[0]!.regel).toEqual(regel);
    expect(erfasst.bereichsregelEditoren[0]!.merkmale).toEqual(MERKMALE);
    expect(erfasst.bereichsregelEditoren[0]!.erfassungsform).toBe('absolut');

    const neueRegel: Bereichsregel = { merkmal: 'stockwerk', bereiche: [{ unter: 3, wert: 1 }, { wert: 2 }] };
    erfasst.bereichsregelEditoren[0]!.aendere(neueRegel);

    expect(aendere).toHaveBeenCalledTimes(1);
    const naechstesEntwurf = aendere.mock.calls[0]![0] as { anpassungsVorlagen: readonly Record<string, unknown>[] };
    expect(naechstesEntwurf.anpassungsVorlagen[1]!['regel']).toEqual(neueRegel);
    // Die Vorlage ohne Regel bleibt unberuehrt.
    expect(naechstesEntwurf.anpassungsVorlagen[0]).toEqual(vorlage({ id: 'ohne-regel' }));
  });
});
