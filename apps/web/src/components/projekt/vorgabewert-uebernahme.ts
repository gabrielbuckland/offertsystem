/** Reine Uebernahme-Funktion fuer `spaltenwerte`, direkt testbar. */
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
