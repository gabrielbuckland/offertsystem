// Reine Serialisierungs-/Parselogik des JSON-Reiters, getrennt von `JsonReiter.tsx`,
// damit sie ohne DOM/React testbar ist (gleiches Muster wie `faktoren-logik.ts`/`zellen-logik.ts`).

export type JsonLeseErgebnis =
  | { readonly ok: true; readonly wert: Record<string, unknown> }
  | { readonly ok: false; readonly text: string };

/** Serialisiert fuer die Anzeige: zwei Leerzeichen Einrueckung (lesbar, diff-freundlich). */
export function alsText(wert: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(wert, null, 2);
}

/**
 * Waehrend des Tippens ist JSON regelmaessig unparsierbar (z. B. `{"a":`); der
 * Fehlerfall traegt deshalb einen anzeigbaren Satz statt zu werfen. Array/Skalar an
 * der Wurzel ist ebenfalls ungueltig, `verwendeEinstellungen` erwartet ein Objekt.
 */
export function ausText(roh: string): JsonLeseErgebnis {
  let geparst: unknown;
  try {
    geparst = JSON.parse(roh);
  } catch {
    return { ok: false, text: 'Das ist kein gültiges JSON.' };
  }
  if (typeof geparst !== 'object' || geparst === null || Array.isArray(geparst)) {
    return { ok: false, text: 'Das ist kein gültiges JSON: Die Wurzel muss ein Objekt sein.' };
  }
  return { ok: true, wert: geparst as Record<string, unknown> };
}
