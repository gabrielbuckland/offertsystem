import { describe, expect, it } from 'vitest';
import { uebernehmeVorgabewert } from '../../../src/components/projekt/vorgabewert-uebernahme.js';
import type { AnpassungsSpalte, ProjektEinheit } from '../../../src/server/projekt-schema.js';

function einheit(id: string, spaltenwerte: Readonly<Record<string, number>>): ProjektEinheit {
  return {
    id, wohnungsnummer: id, referenzobjektId: 'R-1',
    flaecheInnen: 80, flaecheAussen: 10, stockwerk: 1,
    spaltenwerte,
  };
}

function spalte(id: string, vorgabewert: number): AnpassungsSpalte {
  return { id, bezeichnung: id, erfassungsform: 'relativ', vorgabewert };
}

describe('uebernehmeVorgabewert', () => {
  it('fuellt eine leere Zelle (fehlender Schluessel) mit dem Vorgabewert', () => {
    const einheiten = [einheit('E-1', {})];
    const naechste = uebernehmeVorgabewert(einheiten, spalte('S-1', 0.05));
    expect(naechste[0]!.spaltenwerte).toEqual({ 'S-1': 0.05 });
  });

  it('laesst einen vorhandenen Wert 0 unangetastet — 0 ist erfasst, nicht fehlend (I-24)', () => {
    const einheiten = [einheit('E-1', { 'S-1': 0 })];
    const naechste = uebernehmeVorgabewert(einheiten, spalte('S-1', 0.05));
    expect(naechste[0]!.spaltenwerte).toEqual({ 'S-1': 0 });
  });

  it('laesst Werte anderer Spalten unberuehrt', () => {
    const einheiten = [einheit('E-1', { 'S-2': 0.2 })];
    const naechste = uebernehmeVorgabewert(einheiten, spalte('S-1', 0.05));
    expect(naechste[0]!.spaltenwerte).toEqual({ 'S-2': 0.2, 'S-1': 0.05 });
  });
});
