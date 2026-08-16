/**
 * Der eigentliche resolve-Haken. Getrennte Datei, weil `register` das
 * Hakenmodul in einem eigenen Thread laedt.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const QUELLBEREICHE = ['/packages/', '/apps/'];

/**
 * Workspace-Pakete auf ihre Quelle abbilden. Node leistet fuer node_modules kein
 * Type-Stripping (PE-09), und die Workspace-Pakete sind genau dorthin verknuepft. Ohne
 * diese Zuordnung ist kein Programm ausfuehrbar, das ueber `@offert/*` einbindet — etwa
 * der Route Handler beim Erzeugen der Beispiel-Offerte.
 */
const PAKETE = {
  '@offert/core': 'packages/core/src/index.ts',
  '@offert/pricehubble': 'packages/pricehubble/src/index.ts',
  '@offert/offer': 'packages/offer/src/index.ts',
};

const WURZEL = new URL('../', import.meta.url);

export async function resolve(spezifizierer, kontext, naechster) {
  const paket = PAKETE[spezifizierer];
  if (paket !== undefined) {
    return { url: new URL(paket, WURZEL).href, shortCircuit: true };
  }
  for (const [name, quelle] of Object.entries(PAKETE)) {
    if (spezifizierer.startsWith(`${name}/`)) {
      const rest = spezifizierer.slice(name.length + 1);
      const alsTs = rest.endsWith('.js') ? `${rest.slice(0, -3)}.ts` : rest;
      const basis = quelle.slice(0, quelle.indexOf('/src/') + 1);
      return { url: new URL(`${basis}${alsTs}`, WURZEL).href, shortCircuit: true };
    }
  }

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
