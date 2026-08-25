import { describe, expect, it } from 'vitest';
import {
  pruefeBereiche, werteBereichsregelAus, type Bereich,
} from '../../src/modell/bereichsregel.js';

const STAFFEL: readonly Bereich[] = [
  { unter: 1, wert: 0 },
  { unter: 2, wert: 100 },
  { unter: 3, wert: 200 },
  { wert: 300 },
];

describe('pruefeBereiche', () => {
  it('nimmt eine aufsteigende Staffel mit Restfall an', () => {
    expect(pruefeBereiche(STAFFEL)).toEqual([]);
  });

  it('weist eine leere Bereichsliste zurueck', () => {
    expect(pruefeBereiche([])).toHaveLength(1);
  });

  it('weist nicht aufsteigende Schwellen zurueck', () => {
    const befunde = pruefeBereiche([{ unter: 2, wert: 0 }, { unter: 1, wert: 100 }, { wert: 200 }]);
    expect(befunde.join(' ')).toContain('aufsteigend');
  });

  it('weist gleiche Schwellen zurueck — streng aufsteigend, nicht nur sortiert', () => {
    const befunde = pruefeBereiche([{ unter: 1, wert: 0 }, { unter: 1, wert: 100 }, { wert: 200 }]);
    expect(befunde.join(' ')).toContain('aufsteigend');
  });

  it('weist eine Staffel ohne Restfall zurueck', () => {
    const befunde = pruefeBereiche([{ unter: 1, wert: 0 }, { unter: 2, wert: 100 }]);
    expect(befunde.join(' ')).toContain('Restfall');
  });

  it('weist einen Restfall zurueck, der nicht am Schluss steht', () => {
    const befunde = pruefeBereiche([{ wert: 0 }, { unter: 2, wert: 100 }]);
    expect(befunde.join(' ')).toContain('Restfall');
  });

  it('weist nicht endliche Schwellen und Werte zurueck', () => {
    expect(pruefeBereiche([{ unter: Number.NaN, wert: 0 }, { wert: 1 }])).not.toEqual([]);
    expect(pruefeBereiche([{ unter: 1, wert: Number.POSITIVE_INFINITY }, { wert: 1 }])).not.toEqual([]);
  });
});

describe('werteBereichsregelAus', () => {
  const regel = { merkmal: 'stockwerk', bereiche: STAFFEL };

  it('trifft den ersten Bereich unterhalb der ersten Schwelle', () => {
    expect(werteBereichsregelAus(regel, 0)).toEqual({ wert: 0, bereich: 0 });
  });

  it('behandelt die Schwelle als exklusive Obergrenze', () => {
    expect(werteBereichsregelAus(regel, 1)).toEqual({ wert: 100, bereich: 1 });
    expect(werteBereichsregelAus(regel, 2)).toEqual({ wert: 200, bereich: 2 });
  });

  it('faellt in den Restfall', () => {
    expect(werteBereichsregelAus(regel, 3)).toEqual({ wert: 300, bereich: 3 });
    expect(werteBereichsregelAus(regel, 99)).toEqual({ wert: 300, bereich: 3 });
  });

  it('behandelt negative Merkmalswerte wie jeden anderen Wert — Untergeschoss ist kein Sonderfall', () => {
    expect(werteBereichsregelAus(regel, -1)).toEqual({ wert: 0, bereich: 0 });
  });
});
