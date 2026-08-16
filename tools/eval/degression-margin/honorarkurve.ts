/**
 * Geschlossene Auswertung von eq:honorar_mapping ohne Pipeline-Durchlauf (Spec 06 §7.2).
 *
 * Zwei Festlegungen aus E-11: Die Auswertung geschieht JE RANDKURVE GETRENNT — hMin und
 * hMax sind unabhaengige Stuetzstellen ohne festes Verhaeltnis —, und sie ist eine reine
 * Funktion der Konfiguration, ohne Projektdaten.
 *
 * Oberhalb der letzten Stuetzstelle liefert die Funktion `null`: Das Modell ist dort nach
 * E-04 nicht definiert, und eine Extrapolation waere eine Zahl, die aussieht wie ein
 * Ergebnis, ohne eines zu sein.
 *
 * Die Funktionen sind eine ZWEITIMPLEMENTIERUNG derselben Formel. Sie sind nur als
 * Messgrundlage zulaessig, solange sie mit Stufe 5 des Kerns uebereinstimmen; ein Test
 * prueft genau das.
 */
export interface Stuetzstelle {
  readonly v: number; // Rappen
  readonly hMin: number; // Rappen
  readonly hMax: number; // Rappen
}

export type Randkurve = 'hMin' | 'hMax';

export function stufeVon(stuetzstellen: readonly Stuetzstelle[], v: number): number | null {
  const letzte = stuetzstellen.length - 1;
  if (letzte < 1) return null;
  if (v < stuetzstellen[0]!.v) return null;
  if (v > stuetzstellen[letzte]!.v) return null;
  if (v === stuetzstellen[letzte]!.v) return letzte - 1;
  for (let k = 0; k < letzte; k += 1) {
    if (v >= stuetzstellen[k]!.v && v < stuetzstellen[k + 1]!.v) return k;
  }
  return null;
}

export function honorarbasis(
  stuetzstellen: readonly Stuetzstelle[],
  randkurve: Randkurve,
  v: number,
): number | null {
  const k = stufeVon(stuetzstellen, v);
  if (k === null) return null;
  const links = stuetzstellen[k]!;
  const rechts = stuetzstellen[k + 1]!;
  const t = (v - links.v) / (rechts.v - links.v);
  return links[randkurve] + t * (rechts[randkurve] - links[randkurve]);
}

/** phi(V) = H(V)/V, der relative Honorarsatz. */
export function durchschnittssatz(
  stuetzstellen: readonly Stuetzstelle[],
  randkurve: Randkurve,
  v: number,
): number | null {
  if (v <= 0) return null;
  const h = honorarbasis(stuetzstellen, randkurve, v);
  return h === null ? null : h / v;
}

export interface Skalierung {
  readonly form: 'linear';
  readonly gMin: number;
  readonly gMax: number;
}

/** g(D) = gMin + D * (gMax - gMin); Formelverweis: eq:honorar_mapping (E-32). */
export function gVon(s: Skalierung, d: number): number {
  return s.gMin + d * (s.gMax - s.gMin);
}
