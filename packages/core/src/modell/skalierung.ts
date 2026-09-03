// g: [0,1] -> [g_min, g_max], monoton steigend, mit 0 < g_min <= 1 <= g_max
// (I-15, I-16). Teil von eq:honorar_mapping. g(D) wirkt als gemeinsamer Faktor auf H_min
// und H_max, wodurch die relative Range-Breite erhalten bleibt (I-17).
import type { Skalierungsparameter } from '../config/typen.js';

export function skalierung(d: number, parameter: Skalierungsparameter): number {
  if (!Number.isFinite(d) || d < 0 || d > 1) {
    // Defensive Zusicherung, kein Sonderfall des Fehlerkontrakts: Stufe 4 garantiert
    // D in [0,1] (I-12, property-geprueft); dieser Zweig ist im Pipeline-Verbund
    // unerreichbar und zeigt einen Programmierfehler des Aufrufers an.
    throw new Error(
      `Programmierfehler: D muss in [0, 1] liegen (Vorbedingung I-12), erhalten: ${d}`,
    );
  }
  return parameter.gMin + d * (parameter.gMax - parameter.gMin);
}
