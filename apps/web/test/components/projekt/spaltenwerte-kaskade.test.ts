import { describe, expect, it } from 'vitest';
import { entferneSpaltenwert } from '../../../src/components/projekt/spaltenwerte-kaskade.js';
import type { ProjektEinheit } from '../../../src/server/projekt-schema.js';

function einheit(id: string, spaltenwerte: Readonly<Record<string, number>>): ProjektEinheit {
  return {
    id, wohnungsnummer: id, referenzobjektId: 'R-1',
    flaecheInnen: 80, flaecheAussen: 10, stockwerk: 1,
    spaltenwerte, manuelleAnpassungen: [],
  };
}

describe('entferneSpaltenwert', () => {
  it('entfernt den Wert der Spalte aus jeder Einheit, die ihn fuehrt', () => {
    const einheiten = [einheit('E-1', { 'S-1': 0.05 }), einheit('E-2', { 'S-1': 0.1 })];
    const naechste = entferneSpaltenwert(einheiten, 'S-1');
    expect(naechste[0]!.spaltenwerte).not.toHaveProperty('S-1');
    expect(naechste[1]!.spaltenwerte).not.toHaveProperty('S-1');
  });

  it('laesst Einheiten unveraendert, die den Wert nie hatten', () => {
    const einheiten = [einheit('E-1', { 'S-2': 0.2 })];
    const naechste = entferneSpaltenwert(einheiten, 'S-1');
    expect(naechste[0]).toEqual(einheiten[0]);
  });

  it('laesst die Werte anderer Spalten derselben Einheit unangetastet', () => {
    const einheiten = [einheit('E-1', { 'S-1': 0.05, 'S-2': 0.2 })];
    const naechste = entferneSpaltenwert(einheiten, 'S-1');
    expect(naechste[0]!.spaltenwerte).toEqual({ 'S-2': 0.2 });
  });

  it('behandelt eine leere Einheitenliste', () => {
    expect(entferneSpaltenwert([], 'S-1')).toEqual([]);
  });
});
