import { describe, expect, it } from 'vitest';
import { erzeugeEinheiten } from '../../src/server/einheiten-generator.js';
import type { AnpassungsSpalte } from '../../src/server/projekt-schema.js';

const REFS = [
  { id: 'R-1', zimmerzahl: 3.5 },
  { id: 'R-2', zimmerzahl: 4.5 },
] as never as Parameters<typeof erzeugeEinheiten>[1];

const OHNE_SPALTEN: readonly AnpassungsSpalte[] = [];

describe('erzeugeEinheiten', () => {
  it('erzeugt die verlangte Anzahl je Referenzobjekt', () => {
    const neue = erzeugeEinheiten(
      [{ referenzobjektId: 'R-1', anzahl: 2 }, { referenzobjektId: 'R-2', anzahl: 3 }],
      REFS, [], OHNE_SPALTEN);
    expect(neue).toHaveLength(5);
    expect(neue.filter((e) => e.referenzobjektId === 'R-1')).toHaveLength(2);
  });

  it('vergibt eindeutige Wohnungsnummern', () => {
    const neue = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 3 }], REFS, [], OHNE_SPALTEN);
    expect(new Set(neue.map((e) => e.wohnungsnummer)).size).toBe(3);
  });

  it('kollidiert nicht mit bereits vorhandenen Nummern', () => {
    const vorhanden = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 2 }], REFS, [], OHNE_SPALTEN);
    const weitere = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 2 }], REFS, vorhanden, OHNE_SPALTEN);
    const alle = [...vorhanden, ...weitere].map((e) => e.wohnungsnummer);
    expect(new Set(alle).size).toBe(4);
  });

  it('legt Flaechen auf null an, damit sie bewusst erfasst werden', () => {
    const neue = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 1 }], REFS, [], OHNE_SPALTEN);
    expect(neue[0]!.flaecheInnen).toBe(0);
    expect(neue[0]!.spaltenwerte).toEqual({});
  });

  it('vergibt eindeutige Ids, auch wenn eine Einheit geloescht und eine andere '
    + 'umbenannt wurde', () => {
    // Nutzer loescht die erste Einheit und benennt die verbleibende zweite um (Task 11,
    // editierbare Wohnungsnummer). Deren Kennung bleibt unveraendert, ihre Nummer ist nun
    // frei fuer die naechste Generierung — genau dieser Fall liess die alte, aus der
    // Nummer abgeleitete Kennung mit der neu erzeugten Einheit kollidieren.
    const erste = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 2 }], REFS, [], OHNE_SPALTEN);
    const uebrig = [{ ...erste[1]!, wohnungsnummer: 'PH' }];
    const weitere = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 1 }], REFS, uebrig, OHNE_SPALTEN);
    const alle = [...uebrig, ...weitere];
    expect(new Set(alle.map((e) => e.id)).size).toBe(alle.length);
  });
});

/**
 * Der Vorgabewert einer Spalte war ein Bedienelement ohne Wirkung: Er wurde erfasst und
 * gespeichert, aber von niemandem gelesen — weder von `projektion.ts` noch beim Anlegen
 * einer Einheit. Diese Suite haelt fest, dass er jetzt in neue Einheiten uebernommen wird.
 */
describe('erzeugeEinheiten — Vorgabewerte der Spalten', () => {
  const spalte = (id: string, vorgabewert: number, erfassungsform: AnpassungsSpalte['erfassungsform'] = 'relativ'): AnpassungsSpalte => ({
    id, bezeichnung: `Spalte ${id}`, erfassungsform, vorgabewert,
  });

  it('uebernimmt den Vorgabewert jeder Spalte in die neue Einheit', () => {
    const neue = erzeugeEinheiten(
      [{ referenzobjektId: 'R-1', anzahl: 2 }], REFS, [],
      [spalte('S-1', 0.05), spalte('S-2', 250_000, 'absolut')]);
    for (const e of neue) expect(e.spaltenwerte).toEqual({ 'S-1': 0.05, 'S-2': 250_000 });
  });

  it('traegt einen neutralen Vorgabewert gar nicht erst ein', () => {
    // Eine Null im Artefakt saehe aus wie eine erfasste Entscheidung, ist aber keine;
    // `projiziere` ueberspringt sie ohnehin.
    const neue = erzeugeEinheiten(
      [{ referenzobjektId: 'R-1', anzahl: 1 }], REFS, [],
      [spalte('S-1', 0), spalte('S-2', -0.08)]);
    expect(neue[0]!.spaltenwerte).toEqual({ 'S-2': -0.08 });
  });

  it('gibt jeder Einheit ein eigenes Spaltenwerte-Objekt', () => {
    // Ein geteiltes Objekt liesse eine Zelleingabe auf alle Einheiten durchschlagen.
    const neue = erzeugeEinheiten(
      [{ referenzobjektId: 'R-1', anzahl: 2 }], REFS, [], [spalte('S-1', 0.05)]);
    expect(neue[0]!.spaltenwerte).not.toBe(neue[1]!.spaltenwerte);
  });

  it('belegt eine Spalte mit Regel NICHT vor — sonst truege jede Einheit sofort eine '
    + 'Uebersteuerung', () => {
    const spalten: readonly AnpassungsSpalte[] = [{
      id: 'S-1', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut',
      regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }, { wert: 1000000 }] },
    }];
    const neue = erzeugeEinheiten(
      [{ referenzobjektId: 'R-1', anzahl: 1 }], REFS, [], spalten);
    expect(neue[0]!.spaltenwerte).toEqual({});
  });
});
