// eq:honorar_mapping, eq:degression_stufe, eq:netto_degression — ohne Projektdaten
// auswertbar (I-21); hMin/hMax getrennt geprueft, da unabhaengig konfigurierbar (E-11).
import { fehler, type KonfigurationsFehler } from './fehlercodes.js';
import type { RohKonfiguration, RohStuetzstelle } from './schema.js';

export type Randkurve = 'hMin' | 'hMax';

const RANDKURVEN: readonly Randkurve[] = ['hMin', 'hMax'];

// eq:honorar_mapping — lineare Interpolation zwischen Stuetzstellen. Oberhalb der
// hoechsten Stuetzstelle keine Extrapolation (E-04). Rueckgabe ungerundet; gerundet wird
// erst nach Multiplikation mit g(D) (Rundungsstelle R3, E-09).
export function interpoliereHonorarbasis(
  stuetzstellen: readonly RohStuetzstelle[],
  v: number,
  kurve: Randkurve,
): number | undefined {
  const erste = stuetzstellen[0];
  const letzte = stuetzstellen[stuetzstellen.length - 1];
  if (stuetzstellen.length < 2 || erste === undefined || letzte === undefined) return undefined;
  if (v < erste.v || v > letzte.v) return undefined;
  if (v === letzte.v) return letzte[kurve];

  for (let k = 0; k < stuetzstellen.length - 1; k += 1) {
    const links = stuetzstellen[k];
    const rechts = stuetzstellen[k + 1];
    if (links === undefined || rechts === undefined) continue;
    if (v >= links.v && v < rechts.v && rechts.v > links.v) {
      const anteil = (v - links.v) / (rechts.v - links.v);
      return links[kurve] + anteil * (rechts[kurve] - links[kurve]);
    }
  }
  return undefined;
}

// eq:degression_stufe (I-19) — Grenzsatz darf Durchschnittssatz nicht erreichen. Geprueft
// in Produktform s_k * V_k^max < H^(k+1), vermeidet Division und den Sonderfall V=0 in
// der ersten Stufe. Randpruefung genuegt, da phi auf einer Stufe streng faellt sobald
// s_k < phi(V_k^max).
export function pruefeStufenDegression(
  stuetzstellen: readonly RohStuetzstelle[],
): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [];
  for (let k = 0; k < stuetzstellen.length - 1; k += 1) {
    const links = stuetzstellen[k];
    const rechts = stuetzstellen[k + 1];
    if (links === undefined || rechts === undefined) continue;
    const breite = rechts.v - links.v;
    if (breite <= 0) continue; // Ordnungsverletzung meldet CFG_TIER_ORDER
    for (const kurve of RANDKURVEN) {
      const grenzsatz = (rechts[kurve] - links[kurve]) / breite;
      if (!(grenzsatz * rechts.v < rechts[kurve])) {
        befunde.push(fehler('CFG_TIER_DEGRESSION', `honorar.stuetzstellen[${k + 1}].${kurve}`, {
          stufe: k,
          kurve,
          vMin: links.v,
          vMax: rechts.v,
          grenzsatz,
          durchschnittssatzAmRand: rechts[kurve] / rechts.v,
          formel: 'eq:degression_stufe',
        }));
      }
    }
  }
  return befunde;
}

export interface NettoDegressionsBefund {
  readonly lambda: number;
  readonly rhoMax: number;
  readonly schwelle: number;
  readonly kleinsteMarge: number;
  readonly engstesV: number;
  readonly verletzendesV: number | undefined;
}

// Suche ueber Quellschluessel `einheitenzahl` (E-05, PE-03), nicht ueber den Faktorschluessel:
// wie der Faktor heisst ist Konfigurationssache, woher er seinen Rohwert bezieht ist tragend.
function findeEinheitenzahlGewicht(konfiguration: RohKonfiguration): {
  readonly gewicht: number;
  readonly mMin: number;
  readonly mMax: number;
} | undefined {
  for (const faktor of Object.values(konfiguration.aufwandfaktoren)) {
    if (faktor.quelle === 'abgeleitet' && faktor.quellSchluessel === 'einheitenzahl') {
      const mMin = Math.min(faktor.min, faktor.max);
      const mMax = Math.max(faktor.min, faktor.max);
      if (mMin <= 0 || mMax <= mMin) return undefined;
      return { gewicht: faktor.gewicht, mMin, mMax };
    }
  }
  return undefined;
}

// eq:netto_degression (I-18) — relativer Honorarsatz darf mit steigender Einheitenzahl
// nicht steigen. Pruefgitter endlich/vollstaendig, da oberhalb der hoechsten Stuetzstelle
// kein Projektpaar mehr existiert (E-04): geprueft werden die Stuetzstellen, ihre durch
// lambda geteilten Urbilder und die Stufenmitten, beschraenkt auf lambda*V <= V_K.
export function berechneNettoDegression(
  konfiguration: RohKonfiguration,
): NettoDegressionsBefund | undefined {
  // Bewusst nicht `projektumfang` benannt: Der Faktor heisst in der Standardkonfiguration
  // zufaellig so, koennte aber jeden Bezeichner fuehren (gesucht wird ueber den Quellschluessel).
  const umfangFaktor = findeEinheitenzahlGewicht(konfiguration);
  if (umfangFaktor === undefined) return undefined;

  const stuetzstellen = konfiguration.honorar.stuetzstellen;
  const letzte = stuetzstellen[stuetzstellen.length - 1];
  if (stuetzstellen.length < 2 || letzte === undefined) return undefined;

  const { gMin, gMax } = konfiguration.honorar.skalierung;
  if (gMin <= 0) return undefined;

  const lambda = umfangFaktor.mMax / umfangFaktor.mMin;
  const rhoMax = (gMin + umfangFaktor.gewicht * (gMax - gMin)) / gMin;
  const schwelle = 1 / rhoMax;

  const kandidaten = new Set<number>();
  for (let k = 0; k < stuetzstellen.length; k += 1) {
    const punkt = stuetzstellen[k];
    if (punkt === undefined) continue;
    kandidaten.add(punkt.v);
    kandidaten.add(punkt.v / lambda);
    const naechster = stuetzstellen[k + 1];
    if (naechster !== undefined) kandidaten.add((punkt.v + naechster.v) / 2);
  }

  const gitter = [...kandidaten].filter((v) => v > 0 && v * lambda <= letzte.v).sort((a, b) => a - b);

  let kleinsteMarge = Number.POSITIVE_INFINITY;
  let engstesV = 0;
  let verletzendesV: number | undefined;

  for (const v of gitter) {
    for (const kurve of RANDKURVEN) {
      const basisKlein = interpoliereHonorarbasis(stuetzstellen, v, kurve);
      const basisGross = interpoliereHonorarbasis(stuetzstellen, v * lambda, kurve);
      if (basisKlein === undefined || basisGross === undefined) continue;
      const phiKlein = basisKlein / v;
      const phiGross = basisGross / (v * lambda);
      const verhaeltnis = phiGross / phiKlein;
      const marge = 1 - verhaeltnis / schwelle;
      if (marge < kleinsteMarge) {
        kleinsteMarge = marge;
        engstesV = v;
      }
      // Toleranz 1e-9: Bestandteil der Invariantendefinition, nicht im Testcode versteckt.
      if (verhaeltnis > schwelle + 1e-9 && verletzendesV === undefined) verletzendesV = v;
    }
  }

  if (!Number.isFinite(kleinsteMarge)) return undefined;
  return { lambda, rhoMax, schwelle, kleinsteMarge, engstesV, verletzendesV };
}

export function pruefeNettoDegression(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befund = berechneNettoDegression(konfiguration);
  if (befund === undefined || befund.verletzendesV === undefined) return [];
  return [
    fehler('CFG_NET_DEGRESSION', 'honorar', {
      lambda: befund.lambda,
      rhoMax: befund.rhoMax,
      schwelle: befund.schwelle,
      verletzendesV: befund.verletzendesV,
      kleinsteMarge: befund.kleinsteMarge,
      formel: 'eq:netto_degression',
    }),
  ];
}
