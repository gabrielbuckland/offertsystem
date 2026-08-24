import { describe, expect, it } from 'vitest';
import { erzeugeEinheiten } from '../../src/server/einheiten-generator.js';

const REFS = [
  { id: 'R-1', zimmerzahl: 3.5 },
  { id: 'R-2', zimmerzahl: 4.5 },
] as never as Parameters<typeof erzeugeEinheiten>[1];

describe('erzeugeEinheiten', () => {
  it('erzeugt die verlangte Anzahl je Referenzobjekt', () => {
    const neue = erzeugeEinheiten(
      [{ referenzobjektId: 'R-1', anzahl: 2 }, { referenzobjektId: 'R-2', anzahl: 3 }],
      REFS, []);
    expect(neue).toHaveLength(5);
    expect(neue.filter((e) => e.referenzobjektId === 'R-1')).toHaveLength(2);
  });

  it('vergibt eindeutige Wohnungsnummern', () => {
    const neue = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 3 }], REFS, []);
    expect(new Set(neue.map((e) => e.wohnungsnummer)).size).toBe(3);
  });

  it('kollidiert nicht mit bereits vorhandenen Nummern', () => {
    const vorhanden = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 2 }], REFS, []);
    const weitere = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 2 }], REFS, vorhanden);
    const alle = [...vorhanden, ...weitere].map((e) => e.wohnungsnummer);
    expect(new Set(alle).size).toBe(4);
  });

  it('legt Flaechen auf null an, damit sie bewusst erfasst werden', () => {
    const neue = erzeugeEinheiten([{ referenzobjektId: 'R-1', anzahl: 1 }], REFS, []);
    expect(neue[0]!.flaecheInnen).toBe(0);
    expect(neue[0]!.spaltenwerte).toEqual({});
  });
});
