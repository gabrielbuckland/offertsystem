/**
 * Auswertung von eq:netto_degression ueber ein Gitter — analytisch, ohne
 * Pipeline-Durchlauf.
 *
 * Zwei Projekte unterscheiden sich ausschliesslich in der Einheitenzahl bei gleichem
 * mittlerem Einheitenpreis, also lambda = V2/V1 = m2/m1 > 1. Die Bedingung
 *
 *   H(V2)*g(D2)/V2 <= H(V1)*g(D1)/V1
 *
 * ist gleichwertig zu L <= R mit
 *
 *   L = g(D2)/g(D1)        (haengt allein an g und an D2 - D1)
 *   R = phi(V1)/phi(V2)    (haengt allein an den Stuetzstellen)
 *   M = R/L,  erfuellt genau dann, wenn M >= 1
 *
 * In D aendert sich zwischen den beiden Projekten genau EIN Summand (der Aufwandfaktor
 * mit quellSchluessel 'einheitenzahl'); der unguenstigste Fall ist deshalb ohne Suche
 * bestimmbar, weil g monoton steigend ist (I-15) und g(D1) minimal wird, wenn alle
 * uebrigen Faktoren den Beitrag 0 leisten. Keine Groesse stammt aus einem
 * Pipeline-Durchlauf — der Rechner fuehrt daher keine Konfiguration aus.
 */
import { findeUmfangfaktor, normiereMitKappung } from '../shared/konfig.ts';
import {
  durchschnittssatz,
  gVon,
  stufeVon,
  type Randkurve,
  type Skalierung,
  type Stuetzstelle,
} from './honorarkurve.ts';
import type { Konfiguration } from '../../../packages/core/src/index.ts';

/** L = g(D2)/g(D1) — linke Seite von eq:netto_degression. */
export function linkeSeite(s: Skalierung, d1: number, d2: number): number {
  return gVon(s, d2) / gVon(s, d1);
}

/** R = phi(V1)/phi(V2) — rechte Seite von eq:netto_degression, umgeformt. */
export function rechteSeite(
  stuetzstellen: readonly Stuetzstelle[],
  randkurve: Randkurve,
  v1: number,
  v2: number,
): number | null {
  const phi1 = durchschnittssatz(stuetzstellen, randkurve, v1);
  const phi2 = durchschnittssatz(stuetzstellen, randkurve, v2);
  if (phi1 === null || phi2 === null || phi2 === 0) return null;
  return phi1 / phi2;
}

/** M = R/L; Bedingung erfuellt genau dann, wenn M >= 1. */
export function marge(r: number, l: number): number {
  return r / l;
}

/**
 * Je Stufe vier Anteilspunkte plus ein Rappen unterhalb der oberen Stuetzstelle (die
 * Stufe ist halboffen), dazu die letzte Stuetzstelle. V = 0 entfaellt, weil phi dort
 * nicht definiert ist.
 */
export function stichprobeV1(stuetzstellen: readonly Stuetzstelle[]): readonly number[] {
  const punkte = new Set<number>();
  for (let k = 0; k < stuetzstellen.length - 1; k += 1) {
    const links = stuetzstellen[k]!.v;
    const breite = stuetzstellen[k + 1]!.v - links;
    for (const s of [0, 0.25, 0.5, 0.75]) punkte.add(links + Math.round(s * breite));
    punkte.add(stuetzstellen[k + 1]!.v - 1);
  }
  punkte.add(stuetzstellen[stuetzstellen.length - 1]!.v);
  return [...punkte].filter((v) => v > 0).sort((a, b) => a - b);
}

export interface Konstellation {
  readonly randkurve: Randkurve;
  readonly k: number;
  readonly m1: number;
  readonly m2: number;
  readonly v1_rappen: number;
  readonly v2_rappen: number;
  readonly d1: number;
  readonly d2: number;
  readonly l: number;
  readonly r: number;
  readonly m: number;
}

/**
 * Vergleichsschwelle fuer den zweiten Kennwert: Die Reserve wird am Grenzfall grosser
 * Projektspruenge hergeleitet (lambda = 9); ueber das feine Gitter liegt das Minimum
 * dagegen bei lambda knapp ueber 1, wo Degressionsgewinn und Aufwandzuschlag beide fast
 * null sind. Beide Kennwerte werden ausgewiesen, damit der Vergleich mit der Herleitung
 * moeglich bleibt, ohne die eigentliche Messung zu beschoenigen.
 */
export const LAMBDA_SCHWELLE_GROSS = 3;

export interface MargenBefund {
  readonly margin_min: number;
  /** Kleinste Marge unter den Konstellationen mit lambda >= LAMBDA_SCHWELLE_GROSS. */
  readonly margin_min_grosser_sprung: number;
  readonly argmin: Konstellation | null;
  readonly margin_min_je_randkurve: Readonly<Record<Randkurve, number>>;
  readonly konstellationen_geprueft: number;
  readonly konstellationen_verworfen: number;
  readonly w_umfang: number;
  readonly l_obergrenze_grob: number;
  readonly l_obergrenze_scharf: number;
}

export const M1_BEREICH = { von: 3, bis: 40 } as const;
export const DELTA_BEREICH = { von: 1, bis: 40 } as const;

export function margeUeberGitter(konfig: Konfiguration): MargenBefund {
  const stuetz = konfig.honorar.stuetzstellen as readonly Stuetzstelle[];
  const skal = konfig.honorar.skalierung;
  const umfang = findeUmfangfaktor(konfig);
  if (umfang === null) {
    throw new Error('Kein Aufwandfaktor mit quellSchluessel einheitenzahl');
  }
  // Kerntyp: grenzeMin/grenzeMax; Rohform: min/max (PE-01).
  const { gewicht: wU, grenzeMin: minU, grenzeMax: maxU } = umfang.parameter;

  const xDach = (m: number): number => normiereMitKappung(m, minU, maxU);
  const punkte = stichprobeV1(stuetz);
  const vMax = stuetz[stuetz.length - 1]!.v;

  let best: Konstellation | null = null;
  const bestJeRandkurve: Record<Randkurve, number> = { hMin: Infinity, hMax: Infinity };
  let bestGrosserSprung = Infinity;
  let geprueft = 0;
  let verworfen = 0;

  for (const randkurve of ['hMin', 'hMax'] as const) {
    for (let m1 = M1_BEREICH.von; m1 <= M1_BEREICH.bis; m1 += 1) {
      for (let d = DELTA_BEREICH.von; d <= DELTA_BEREICH.bis; d += 1) {
        const m2 = m1 + d;
        const lambda = m2 / m1;
        const d1 = wU * xDach(m1);
        const d2 = wU * xDach(m2);
        const l = linkeSeite(skal, d1, d2);
        for (const v1 of punkte) {
          const v2 = Math.round(lambda * v1);
          // Oberhalb der letzten Stuetzstelle ist das Modell nicht definiert (E-04);
          // eine Marge dafuer waere eine Aussage ueber einen Bereich, den die Arbeit
          // nicht behandelt. Die Zahl der Verwerfungen wird ausgewiesen.
          if (v2 > vMax) { verworfen += 1; continue; }
          const r = rechteSeite(stuetz, randkurve, v1, v2);
          if (r === null) { verworfen += 1; continue; }
          geprueft += 1;
          const m = marge(r, l);
          if (m < bestJeRandkurve[randkurve]) bestJeRandkurve[randkurve] = m;
          if (lambda >= LAMBDA_SCHWELLE_GROSS && m < bestGrosserSprung) {
            bestGrosserSprung = m;
          }
          if (best === null || m < best.m) {
            best = {
              randkurve, k: stufeVon(stuetz, v1) ?? -1, m1, m2,
              v1_rappen: v1, v2_rappen: v2, d1, d2, l, r, m,
            };
          }
        }
      }
    }
  }

  return {
    margin_min: best?.m ?? Infinity,
    margin_min_grosser_sprung: bestGrosserSprung,
    argmin: best,
    margin_min_je_randkurve: bestJeRandkurve,
    konstellationen_geprueft: geprueft,
    konstellationen_verworfen: verworfen,
    w_umfang: wU,
    l_obergrenze_grob: skal.gMax / skal.gMin,
    l_obergrenze_scharf: (skal.gMin + wU * (skal.gMax - skal.gMin)) / skal.gMin,
  };
}
