import { describe, expect, it } from 'vitest';
import { ermittleWirksamenWert } from '../../src/server/wirksamer-wert.js';

const MIT_REGEL = {
  id: 'S-1', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut' as const,
  regel: {
    merkmal: 'stockwerk',
    bereiche: [{ unter: 1, wert: 0 }, { unter: 2, wert: 1000000 }, { wert: 2000000 }],
  },
};
const OHNE_REGEL = {
  id: 'S-2', bezeichnung: 'Aussicht', erfassungsform: 'relativ' as const, vorgabewert: 0,
};
const einheit = (
  spaltenwerte: Record<string, number>, merkmalswerte: Record<string, number>,
) => ({
  id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
  flaecheInnen: 86, flaecheAussen: 19, spaltenwerte, merkmalswerte,
});

describe('ermittleWirksamenWert', () => {
  it('wertet die Regel aus, wenn keine Uebersteuerung vorliegt', () => {
    expect(ermittleWirksamenWert(MIT_REGEL, einheit({}, { stockwerk: 1 })))
      .toEqual({ wert: 1000000, regel: { merkmal: 'stockwerk', merkmalswert: 1, bereich: 1, regelwert: 1000000 } });
  });

  it('laesst die Uebersteuerung die Regel schlagen und weist den Regelwert weiter aus', () => {
    expect(ermittleWirksamenWert(MIT_REGEL, einheit({ 'S-1': 500000 }, { stockwerk: 1 })))
      .toEqual({
        wert: 500000, uebersteuert: true,
        regel: { merkmal: 'stockwerk', merkmalswert: 1, bereich: 1, regelwert: 1000000 },
      });
  });

  it('ergibt nichts, wenn der Merkmalswert fehlt', () => {
    expect(ermittleWirksamenWert(MIT_REGEL, einheit({}, {}))).toBeUndefined();
  });

  it('laesst eine erfasste Uebersteuerung stehen, auch wenn der Merkmalswert fehlt', () => {
    const ergebnis = ermittleWirksamenWert(MIT_REGEL, einheit({ 'S-1': 500000 }, {}));
    expect(ergebnis).toEqual({ wert: 500000 });
    expect(ergebnis).not.toHaveProperty('regel');
    expect(ergebnis).not.toHaveProperty('uebersteuert');
  });

  it('erkennt eine Uebersteuerung auf 0 als Uebersteuerung — die Anwesenheit entscheidet', () => {
    const ergebnis = ermittleWirksamenWert(MIT_REGEL, einheit({ 'S-1': 0 }, { stockwerk: 2 }));
    expect(ergebnis?.wert).toBe(0);
    expect(ergebnis?.uebersteuert).toBe(true);
  });

  it('liest bei einer Spalte ohne Regel weiterhin den Spaltenwert', () => {
    expect(ermittleWirksamenWert(OHNE_REGEL, einheit({ 'S-2': 0.05 }, {}))).toEqual({ wert: 0.05 });
    expect(ermittleWirksamenWert(OHNE_REGEL, einheit({}, {}))).toBeUndefined();
  });
});
