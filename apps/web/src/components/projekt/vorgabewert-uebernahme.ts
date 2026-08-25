/**
 * Reine Uebernahme-Funktion fuer `spaltenwerte`, getrennt von `AnpassungsSpalten.tsx` und
 * direkt testbar (Muster `spaltenwerte-kaskade.ts`).
 *
 * Traegt den Vorgabewert einer Anpassungsspalte in jene Einheiten ein, die fuer diese
 * Spalte noch KEINEN Wert fuehren — massgeblich ist der fehlende Schluessel in
 * `spaltenwerte`, nicht der Wert selbst. Eine vorhandene 0 ist ein erfasster Wert, kein
 * fehlender (I-24), und bleibt darum unangetastet.
 */
import type { AnpassungsSpalte, ProjektEinheit } from '../../server/projekt-schema.js';

/** Traegt den Vorgabewert der Spalte in alle Einheiten ein, die fuer diese Spalte noch
 *  KEINEN Wert fuehren (fehlender Schluessel in `spaltenwerte`). Bestehende Werte —
 *  auch 0 — bleiben unangetastet: 0 ist ein erfasster Wert, kein fehlender (I-24). */
export function uebernehmeVorgabewert(
  einheiten: readonly ProjektEinheit[], spalte: AnpassungsSpalte,
): readonly ProjektEinheit[] {
  return einheiten.map((einheit) => {
    if (spalte.id in einheit.spaltenwerte) return einheit;
    return {
      ...einheit,
      spaltenwerte: { ...einheit.spaltenwerte, [spalte.id]: spalte.vorgabewert },
    };
  });
}
