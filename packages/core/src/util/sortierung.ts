// Keine Formel. Definierte Iterationsreihenfolge: aufsteigend nach FaktorId
// in Codepoint-Ordnung, ausdruecklich nicht localeCompare.
import type { FaktorId } from '../domain/ids.js';

export function sortiereNachSchluessel<W>(
  m: ReadonlyMap<FaktorId, W>,
): readonly (readonly [FaktorId, W])[] {
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
