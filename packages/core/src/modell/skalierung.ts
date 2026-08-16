// g: [0,1] -> [g_min, g_max], monoton steigend, mit 0 < g_min <= 1 <= g_max (Brief §4,
// I-15, I-16). Teil von eq:honorar_mapping. g(D) wirkt als gemeinsamer Faktor auf H_min
// und H_max, wodurch die relative Range-Breite erhalten bleibt (I-17).
import type { Skalierungsparameter } from '../config/typen.js';

export function skalierung(d: number, parameter: Skalierungsparameter): number {
  if (!Number.isFinite(d) || d < 0 || d > 1) {
    throw new Error(`D muss in [0, 1] liegen (I-12), erhalten: ${d}`);
  }
  return parameter.gMin + d * (parameter.gMax - parameter.gMin);
}
