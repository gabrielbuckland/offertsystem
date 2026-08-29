/**
 * Reine Serialisierungs-/Parselogik des JSON-Reiters (Task 10), getrennt von
 * `JsonReiter.tsx`, damit sie ohne DOM/React testbar ist (gleiches Muster wie
 * `faktoren-logik.ts`/`zellen-logik.ts`). Das Repo hat weder `jsdom` noch
 * `@testing-library/react` installiert — Interaktionsverhalten (Tippen, Cursor)
 * wird deshalb hier an reinen Funktionen geprueft, nicht per `fireEvent`.
 */

export type JsonLeseErgebnis =
  | { readonly ok: true; readonly wert: Record<string, unknown> }
  | { readonly ok: false; readonly text: string };

/** Serialisiert fuer die Anzeige: zwei Leerzeichen Einrueckung (lesbar, diff-freundlich). */
export function alsText(wert: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(wert, null, 2);
}

/**
 * Liest den Rohtext. Waehrend des Tippens ist JSON regelmaessig unparsierbar (z. B.
 * `{"a":`); der Fehlerfall traegt deshalb einen anzeigbaren Satz statt zu werfen. Ein
 * Array oder ein Skalar an der Wurzel ist ebenfalls kein gueltiger Einstellungsbaum —
 * `verwendeEinstellungen` erwartet ein Objekt, kein Array/keinen Skalar.
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

/**
 * Blendet ganze Wurzeln aus der JSON-Sicht aus. Zusammen mit `mitWurzeln` haelt das die
 * Rollentrennung auch im JSON-Reiter durch: Ein Bereich, der im Formular nur lesend
 * gezeigt wird, darf nicht ueber den Umweg des Rohtextes editierbar werden.
 *
 * Die Wurzelliste kommt als Parameter herein und steht nicht als Literal hier — die
 * einzige Wahrheit darueber, was projektbezogen bzw. durch den Auftraggeber
 * unveraenderlich ist, ist `GESPERRTE_PFADE` im Kern.
 */
export function ohneWurzeln(
  wert: Readonly<Record<string, unknown>>, wurzeln: readonly string[],
): Record<string, unknown> {
  const ergebnis: Record<string, unknown> = {};
  for (const [schluessel, inhalt] of Object.entries(wert)) {
    if (wurzeln.includes(schluessel)) continue;
    ergebnis[schluessel] = inhalt;
  }
  return ergebnis;
}

/**
 * Gegenstueck zu `ohneWurzeln`: setzt die ausgeblendeten Wurzeln aus dem unveraenderten
 * Bestand wieder ein. Ein im Rohtext trotzdem eingetippter gesperrter Schluessel wird
 * dabei verworfen — sonst waere die Sperre eine blosse Anzeigekosmetik, die sich durch
 * Tippen umgehen liesse.
 */
export function mitWurzeln(
  bearbeitet: Readonly<Record<string, unknown>>,
  bestand: Readonly<Record<string, unknown>>,
  wurzeln: readonly string[],
): Record<string, unknown> {
  const ergebnis = ohneWurzeln(bearbeitet, wurzeln);
  for (const wurzel of wurzeln) {
    if (Object.hasOwn(bestand, wurzel)) ergebnis[wurzel] = bestand[wurzel];
  }
  return ergebnis;
}
