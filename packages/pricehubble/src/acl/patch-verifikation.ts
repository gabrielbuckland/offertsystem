/**
 * Keine Formel. Rueckvergleich des gesendeten E3-Bodys (Spec 04 §5.4).
 *
 * Ein stillschweigend ignorierter oder gerundeter Parameter fuehrte sonst zu einer
 * Bewertung auf einem anderen Objekt, als der Vermarkter erfasst hat.
 * Abweichung ⇒ ContractViolation.
 */
import type { DossierBody } from './bewertung-mapper.js';

/** Toleranz fuer Gleitkommaflaechen (Spec 04 §5.4). */
const TOLERANZ = 1e-9;

function gleich(gesendet: unknown, zurueck: unknown): boolean {
  if (typeof gesendet === 'number' && typeof zurueck === 'number') {
    return Math.abs(gesendet - zurueck) <= TOLERANZ;
  }
  if (gesendet !== null && typeof gesendet === 'object') {
    if (zurueck === null || typeof zurueck !== 'object') {
      return false;
    }
    const a = gesendet as Record<string, unknown>;
    const b = zurueck as Record<string, unknown>;
    return Object.keys(a).every((schluessel) => gleich(a[schluessel], b[schluessel]));
  }
  return gesendet === zurueck;
}

/** @returns Liste der abweichenden Pfade; leer bedeutet vertragskonform. */
export function verifiziereGesendetePatchFelder(
  gesendet: DossierBody,
  antwort: unknown,
): string[] {
  const zurueck = (antwort as { property?: Record<string, unknown> } | null)?.property ?? {};
  return Object.entries(gesendet.property)
    .filter(([schluessel, wert]) => !gleich(wert, zurueck[schluessel]))
    .map(([schluessel]) => `property.${schluessel}`);
}
