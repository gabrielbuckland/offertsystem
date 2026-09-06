export type JsonLeseErgebnis =
  | { readonly ok: true; readonly wert: Record<string, unknown> }
  | { readonly ok: false; readonly text: string };

export function alsText(wert: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(wert, null, 2);
}

// Array/Skalar an der Wurzel ist ungueltig, `verwendeEinstellungen` erwartet ein Objekt.
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

// Blendet Wurzeln aus der JSON-Sicht aus, damit ein nur lesend gezeigter Bereich nicht
// ueber den Rohtext editierbar wird.
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

// Gegenstueck zu `ohneWurzeln`: ein trotzdem eingetippter gesperrter Schluessel wird
// verworfen, sonst waere die Sperre nur Anzeigekosmetik.
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
