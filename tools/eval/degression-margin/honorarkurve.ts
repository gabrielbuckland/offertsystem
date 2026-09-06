// Geschlossene Auswertung von eq:honorar_mapping ohne Pipeline-Durchlauf (E-11: je
// Randkurve getrennt, reine Funktion der Konfiguration). Oberhalb der letzten
// Stuetzstelle liefert die Funktion `null` statt zu extrapolieren (E-04). Zweitimplementierung
// derselben Formel — nur zulaessig, solange sie mit Stufe 5 des Kerns uebereinstimmt.
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
