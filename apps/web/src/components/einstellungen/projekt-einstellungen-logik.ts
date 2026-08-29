// Ebene 2 des Zwei-Ebenen-Modells: die beiden Richtungen zwischen Firmenwerten, Delta und
// Formular. `effektiveKonfiguration` (Anzeige) legt das Delta in die Firmenwerte ein;
// `bildeDelta` (Speichern) rechnet umgekehrt nur die Abweichung heraus. Beide sind
// zueinander invers (`bildeDelta(effektiveKonfiguration(f, d), f) === d`) — das haelt der
// Test als Rundlauf fest.
import { GESPERRTE_PFADE } from '@offert/core';

type Baum = Readonly<Record<string, unknown>>;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function effektiveKonfiguration(
  firmenwerte: Baum,
  delta: Baum | undefined,
): Record<string, unknown> {
  if (delta === undefined) return { ...firmenwerte };

  const ergebnis: Record<string, unknown> = { ...firmenwerte };
  for (const [schluessel, wert] of Object.entries(delta)) {
    const basis = firmenwerte[schluessel];
    // Arrays und Skalare als Ganzes, nur Objekte rekursiv — wie im Kern-Merge.
    ergebnis[schluessel] = istObjekt(basis) && istObjekt(wert)
      ? effektiveKonfiguration(basis, wert)
      : wert;
  }
  return ergebnis;
}

// Bildet aus einem bearbeiteten Entwurf das Delta gegen die Firmenwerte: nur Pfade, die
// tatsaechlich abweichen. `meta`/`api` gehoeren nie ins Delta (projektbezogen gesperrt);
// die gesperrten Wurzeln kommen aus `GESPERRTE_PFADE` (`@offert/core`), nicht als eigene
// Literale, damit es nur eine Wahrheit dazu gibt.
//
// Ein im Entwurf fehlender Schluessel gilt als UNVERAENDERT, nicht als geloescht — ein
// Merge, der nur ueberlagert, kann "soll hier fehlen" nicht ausdruecken, und ein versehentlich
// weggeloeschter Block im JSON-Reiter soll nicht stillschweigend die Berechnungsbasis
// beschneiden.
export function bildeDelta(
  entwurf: Baum,
  firmenwerte: Baum,
): Record<string, unknown> {
  // Die Sperre greift nur auf der Wurzel; ein tiefer liegendes Feld, das zufaellig `meta`
  // heisst, bleibt uebersteuerbar.
  return baueDelta(entwurf, firmenwerte, true);
}

function baueDelta(entwurf: Baum, firmenwerte: Baum, wurzel: boolean): Record<string, unknown> {
  const delta: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(entwurf)) {
    if (wurzel && GESPERRTE_PFADE.includes(schluessel)) continue;
    const basis = firmenwerte[schluessel];

    if (istObjekt(basis) && istObjekt(wert)) {
      const teilDelta = baueDelta(wert, basis, false);
      // Leerer Teilbaum kommt nicht ins Delta, sonst meldete die Herkunftsanzeige
      // faelschlich «uebersteuert».
      if (Object.keys(teilDelta).length > 0) delta[schluessel] = teilDelta;
      continue;
    }

    if (!gleich(basis, wert)) delta[schluessel] = wert;
  }
  return delta;
}
