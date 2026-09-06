// `effektiveKonfiguration` und `bildeDelta` sind zueinander invers
// (`bildeDelta(effektiveKonfiguration(f, d), f) === d`).
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
    ergebnis[schluessel] = istObjekt(basis) && istObjekt(wert)
      ? effektiveKonfiguration(basis, wert)
      : wert;
  }
  return ergebnis;
}

// Ein im Entwurf fehlender Schluessel gilt als UNVERAENDERT, nicht als geloescht — ein
// reiner Merge kann "soll hier fehlen" nicht ausdruecken.
export function bildeDelta(
  entwurf: Baum,
  firmenwerte: Baum,
): Record<string, unknown> {
  return baueDelta(entwurf, firmenwerte, true);
}

// Befunde, die keiner Bereichskarte zugeordnet werden koennen (gesperrter Pfad, Rumpf-
// Befund, unbekannter Wurzelschluessel) — Auffangblock, damit ein gescheitertes Speichern
// nicht spurlos bleibt. Wurzeln kommen als Parameter, nicht als Literal (Architekturtest).
export function unverankerteBefunde<T extends { readonly pfad: string }>(
  befunde: readonly T[], wurzeln: readonly string[],
): readonly T[] {
  return befunde.filter((befund) => befund.pfad !== '' && !wurzeln.some(
    (wurzel) => befund.pfad === wurzel
      || befund.pfad.startsWith(`${wurzel}.`)
      || befund.pfad.startsWith(`${wurzel}[`),
  ));
}

function baueDelta(entwurf: Baum, firmenwerte: Baum, wurzel: boolean): Record<string, unknown> {
  const delta: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(entwurf)) {
    if (wurzel && GESPERRTE_PFADE.includes(schluessel)) continue;
    const basis = firmenwerte[schluessel];

    if (istObjekt(basis) && istObjekt(wert)) {
      const teilDelta = baueDelta(wert, basis, false);
      // Leerer Teilbaum nicht ins Delta, sonst meldet die Herkunftsanzeige faelschlich "uebersteuert".
      if (Object.keys(teilDelta).length > 0) delta[schluessel] = teilDelta;
      continue;
    }

    if (!gleich(basis, wert)) delta[schluessel] = wert;
  }
  return delta;
}
