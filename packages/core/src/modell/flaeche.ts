// eq:flaeche — A_j = A_j_innen + alpha * A_j_aussen, alpha aus [0, 1] (I-04).
// Dieselbe Funktion bildet A_t_ref der repraesentativen Parametrisierung und A_j der
// Einheit; nur so kuerzt sich A_t_ref in eq:qm_preis und I-05 haelt exakt.
// Parkplaetze bleiben ohne Preiswirkung (Scope-Ausschluss).
import type { Quadratmeter } from '../domain/geld.js';

export function gewichteteFlaeche(
  innen: Quadratmeter,
  aussen: Quadratmeter,
  alpha: number,
): number {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new Error(`alpha muss in [0, 1] liegen (I-04), erhalten: ${alpha}`);
  }
  return innen + alpha * aussen;
}
