/**
 * Reine Uebernahme-Funktion fuer `spaltenwerte`, getrennt von `AnpassungsSpalten.tsx` und
 * direkt testbar (Muster `spaltenwerte-kaskade.ts`).
 *
 * Traegt den Vorgabewert einer Anpassungsspalte in jene Einheiten ein, die fuer diese
 * Spalte noch KEINEN Wert fuehren — massgeblich ist der fehlende Schluessel in
 * `spaltenwerte`, nicht der Wert selbst. Eine vorhandene 0 ist ein erfasster Wert, kein
 * fehlender (I-24), und bleibt darum unangetastet.
 *
 * Eine Spalte mit `regel` hat KEINEN Vorgabewert (`projekt-schema.ts`: `regel` und
 * `vorgabewert` schliessen sich aus) — es gibt fuer sie nichts zu uebernehmen, die
 * Einheiten bleiben unangetastet.
 */
import type { AnpassungsSpalte, ProjektEinheit } from '../../server/projekt-schema.js';

/** Traegt den Vorgabewert der Spalte in alle Einheiten ein, die fuer diese Spalte noch
 *  KEINEN Wert fuehren (fehlender Schluessel in `spaltenwerte`). Bestehende Werte —
 *  auch 0 — bleiben unangetastet: 0 ist ein erfasster Wert, kein fehlender (I-24). Fehlt
 *  der Vorgabewert selbst (Spalte mit Regel), gibt es nichts zu uebernehmen. */
export function uebernehmeVorgabewert(
  einheiten: readonly ProjektEinheit[], spalte: AnpassungsSpalte,
): readonly ProjektEinheit[] {
  if (spalte.vorgabewert === undefined) return einheiten;
  const vorgabewert = spalte.vorgabewert;
  return einheiten.map((einheit) => {
    if (spalte.id in einheit.spaltenwerte) return einheit;
    return {
      ...einheit,
      spaltenwerte: { ...einheit.spaltenwerte, [spalte.id]: vorgabewert },
    };
  });
}
