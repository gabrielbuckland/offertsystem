import { describe, expect, it } from 'vitest';
import { adjustmentSchema } from '../../src/model/offer.js';

const BASIS = {
  factor: 0.05, enteredAs: 'factor' as const, justification: 'Zuschlag Stockwerklage',
};

describe('adjustmentSchema — Regelspur', () => {
  it('nimmt eine Anpassung ohne Regelspur an — Bestandsofferten bleiben gueltig', () => {
    expect(adjustmentSchema.safeParse(BASIS).success).toBe(true);
  });

  it('nimmt eine Anpassung mit Regelspur an', () => {
    expect(adjustmentSchema.safeParse({
      ...BASIS,
      regel: { merkmal: 'stockwerk', merkmalswert: 2, bereich: 2, regelwert: 0.05 },
    }).success).toBe(true);
  });

  it('nimmt die Markierung einer Uebersteuerung an', () => {
    expect(adjustmentSchema.safeParse({
      ...BASIS, uebersteuert: true,
      regel: { merkmal: 'stockwerk', merkmalswert: 2, bereich: 2, regelwert: 0.08 },
    }).success).toBe(true);
  });

  // regel und uebersteuert sind unabhaengig optional: Fehlt das Merkmal der Regel an
  // der Einheit, gibt es keinen auswertbaren Regelwert, aber die erfasste Uebersteuerung
  // gilt trotzdem (Task 5, wirksamer-wert.ts). Eines impliziert das andere nicht.
  it('nimmt eine Uebersteuerung OHNE Regelspur an', () => {
    expect(adjustmentSchema.safeParse({ ...BASIS, uebersteuert: true }).success).toBe(true);
  });
});
