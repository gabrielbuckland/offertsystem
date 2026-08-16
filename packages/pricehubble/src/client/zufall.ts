/** Keine Formel. Gesaete Zufallsquelle; Werte in [0, 1) wie `Math.random`. */
export type Zufallsquelle = () => number;

/**
 * mulberry32 — kompakter, gesaeter Generator. Er ersetzt `Math.random`, das im
 * Paket verboten ist (E-27): Ein nicht reproduzierbarer Backoff-Lauf waere aus dem
 * Protokollfeld `seed` heraus nicht rekonstruierbar.
 */
export function erzeugeZufallsquelle(startwert: number): Zufallsquelle {
  let zustand = startwert >>> 0;
  return () => {
    zustand = (zustand + 0x6d2b79f5) >>> 0;
    let t = zustand;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Ein Startwert je Testlauf, zwei Verbraucher (E-27): fast-check erhaelt `seed`,
 * die Jitter-Quelle des Adapters den abgeleiteten Strom `seed XOR 1`. Das
 * Protokollfeld bleibt damit einwertig.
 */
export function jitterStromAusLaufSeed(laufSeed: number): Zufallsquelle {
  return erzeugeZufallsquelle((laufSeed ^ 1) >>> 0);
}
