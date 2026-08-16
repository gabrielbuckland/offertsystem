/**
 * Der eigentliche resolve-Haken. Getrennte Datei, weil `register` das
 * Hakenmodul in einem eigenen Thread laedt.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const QUELLBEREICHE = ['/packages/', '/apps/'];

export async function resolve(spezifizierer, kontext, naechster) {
  if (spezifizierer.endsWith('.js') && spezifizierer.startsWith('.')) {
    try {
      const aufgeloest = new URL(spezifizierer, kontext.parentURL);
      const pfad = fileURLToPath(aufgeloest);
      const istQuelle = QUELLBEREICHE.some((teil) => pfad.includes(teil));
      const alsTs = `${pfad.slice(0, -3)}.ts`;
      if (istQuelle && !existsSync(pfad) && existsSync(alsTs)) {
        return naechster(`${spezifizierer.slice(0, -3)}.ts`, kontext);
      }
    } catch {
      // Faellt auf die Standardaufloesung zurueck; ein Fehler hier waere ein
      // Aufloesungsfehler und kein Grund, den Lauf abzubrechen.
    }
  }
  return naechster(spezifizierer, kontext);
}
