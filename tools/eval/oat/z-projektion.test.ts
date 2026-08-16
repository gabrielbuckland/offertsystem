import { describe, expect, it } from 'vitest';
import type { SzenarioEinheit } from '../shared/szenario.ts';
import { projiziereAufKorridor } from './z-projektion.ts';

const einheit: SzenarioEinheit = {
  unit_id: 'W01', typ_id: 'T1', A_innen: 100, A_aussen: 10,
  anpassungen: [
    { a_i: 0.20, begruendung: 'Attikalage mit Dachterrasse.' },
    { a_i: 0.04, begruendung: 'Freie Aussichtslage.' },
  ],
};

describe('projiziereAufKorridor', () => {
  it('laesst eine Einheit innerhalb des Korridors unveraendert', () => {
    const e = projiziereAufKorridor([einheit], -0.25, 0.25);
    expect(e.projiziert).toBe(0);
    expect(e.einheiten[0]!.anpassungen[0]!.a_i).toBe(0.20);
  });

  it('skaliert die Einzelanpassungen proportional auf die neue Obergrenze', () => {
    const e = projiziereAufKorridor([einheit], -0.20, 0.20);
    expect(e.projiziert).toBe(1);
    const summe = e.einheiten[0]!.anpassungen.reduce((a, x) => a + x.a_i, 0);
    expect(summe).toBeCloseTo(0.20, 12);
    expect(e.einheiten[0]!.anpassungen[0]!.a_i / e.einheiten[0]!.anpassungen[1]!.a_i)
      .toBeCloseTo(0.20 / 0.04, 12);
  });

  it('erhaelt die Begruendungen (I-09)', () => {
    const e = projiziereAufKorridor([einheit], -0.20, 0.20);
    expect(e.einheiten[0]!.anpassungen.map((a) => a.begruendung))
      .toEqual(einheit.anpassungen.map((a) => a.begruendung));
  });

  it('laesst eine Einheit ohne Anpassungen unberuehrt', () => {
    const e = projiziereAufKorridor([{ ...einheit, anpassungen: [] }], -0.05, 0.05);
    expect(e.projiziert).toBe(0);
    expect(e.einheiten[0]!.anpassungen).toEqual([]);
  });

  it('haelt z_j strikt oberhalb von -1 (I-06)', () => {
    const stark: SzenarioEinheit = {
      ...einheit,
      anpassungen: [{ a_i: -0.9, begruendung: 'Konstruierter Randfall fuer den Test.' }],
    };
    const e = projiziereAufKorridor([stark], -0.30, 0.30);
    const z = e.einheiten[0]!.anpassungen.reduce((a, x) => a + x.a_i, 0);
    expect(z).toBeGreaterThan(-1);
    expect(z).toBeCloseTo(-0.30, 12);
  });
});
