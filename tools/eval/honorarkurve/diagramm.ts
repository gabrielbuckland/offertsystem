/**
 * Keine Modellformel. Zeichenmodell der Honorarkurve.
 *
 * Die Abszisse ist logarithmisch: Die Stuetzstellen der ausgelieferten Parametrisierung
 * wachsen geometrisch (5, 10, 25, 50, 100, 200 Mio. CHF). Linear aufgetragen laegen fuenf
 * der sechs im linken Viertel und die Knicke waeren nicht mehr zu unterscheiden.
 *
 * Die Flaeche zwischen den Randkurven wird als Folge schmaler Rechtecke gefuellt, weil der
 * PDF-Schreiber bewusst nur Rechteck, Linie und Text kennt. Bei dichter Abtastung ist das
 * von einem Polygon nicht zu unterscheiden.
 */
import type { Stuetzstelle } from '../degression-margin/honorarkurve.ts';
import type { Element, Farbe, Seite } from '../shared/pdf-writer.ts';
import type { Kurvenpunkt } from './kurve.ts';

const BREITE = 520;
const HOEHE = 340;
const RAND_LINKS = 58;
const RAND_RECHTS = 18;
const RAND_OBEN = 66;
const RAND_UNTEN = 48;

const FARBE_MIN: Farbe = [0.35, 0.45, 0.70];
const FARBE_MAX: Farbe = [0.75, 0.40, 0.25];
const FARBE_BAND: Farbe = [0.88, 0.89, 0.93];
const FARBE_MARKE: Farbe = [0.20, 0.55, 0.35];
const GRAU: Farbe = [0.55, 0.55, 0.55];
const GITTER: Farbe = [0.82, 0.82, 0.82];
const SCHWARZ: Farbe = [0, 0, 0];

const RAPPEN_JE_MILLION = 1e8;

/** Schweizer Schreibweise: Komma als Dezimaltrennzeichen. */
export function zahl(wert: number, stellen: number): string {
  return wert.toFixed(stellen).replace('.', ',');
}

export interface Markierung {
  readonly v_rappen: number;
  readonly beschriftung: string;
}

export interface Zeichenoptionen {
  readonly titel: string;
  readonly stuetzstellen: readonly Stuetzstelle[];
  readonly markierung: Markierung | null;
}

export function zeichne(
  kurve: readonly Kurvenpunkt[],
  opt: Zeichenoptionen,
): Seite {
  if (kurve.length < 2) throw new Error('Die Kurve braucht mindestens zwei Abtastpunkte');
  const vVon = kurve[0]!.v_rappen;
  const vBis = kurve[kurve.length - 1]!.v_rappen;
  const pOben = Math.ceil(Math.max(...kurve.map((k) => k.hMax_prozent)) * 1.12 * 2) / 2;
  const zeichenbreite = BREITE - RAND_LINKS - RAND_RECHTS;
  const zeichenhoehe = HOEHE - RAND_OBEN - RAND_UNTEN;
  const oben = RAND_UNTEN + zeichenhoehe;

  const xVon = (v: number): number => RAND_LINKS
    + ((Math.log(v) - Math.log(vVon)) / (Math.log(vBis) - Math.log(vVon))) * zeichenbreite;
  const yVon = (prozent: number): number => RAND_UNTEN + (prozent / pOben) * zeichenhoehe;

  const elemente: Element[] = [];

  // Spielraum der Honorarrange als Flaeche, zuerst gezeichnet und damit hinter allem.
  for (let i = 0; i < kurve.length - 1; i += 1) {
    const a = kurve[i]!;
    const b = kurve[i + 1]!;
    const x = xVon(a.v_rappen);
    const y = yVon(Math.min(a.hMin_prozent, b.hMin_prozent));
    elemente.push({
      art: 'rechteck', x, y,
      breite: Math.max(0.4, xVon(b.v_rappen) - x),
      hoehe: Math.max(0.4, yVon(Math.max(a.hMax_prozent, b.hMax_prozent)) - y),
      fuellung: FARBE_BAND,
    });
  }

  for (let p = 0; p <= pOben + 1e-9; p += 0.5) {
    elemente.push({
      art: 'linie', x1: RAND_LINKS, y1: yVon(p), x2: RAND_LINKS + zeichenbreite, y2: yVon(p),
      breite: 0.4, farbe: GITTER,
    });
    elemente.push({
      art: 'text', x: RAND_LINKS - 24, y: yVon(p) - 2.5, groesse: 7,
      inhalt: zahl(p, 1), farbe: GRAU,
    });
  }

  for (const s of opt.stuetzstellen) {
    if (s.v < vVon || s.v > vBis) continue;
    const x = xVon(s.v);
    elemente.push({
      art: 'linie', x1: x, y1: RAND_UNTEN, x2: x, y2: oben, breite: 0.4, farbe: GITTER,
    });
    elemente.push({
      art: 'text', x: x - 7, y: RAND_UNTEN - 14, groesse: 7,
      inhalt: zahl(s.v / RAPPEN_JE_MILLION, 0), farbe: GRAU,
    });
  }

  elemente.push({
    art: 'linie', x1: RAND_LINKS, y1: RAND_UNTEN, x2: RAND_LINKS + zeichenbreite,
    y2: RAND_UNTEN, breite: 0.8, farbe: SCHWARZ,
  });
  elemente.push({
    art: 'linie', x1: RAND_LINKS, y1: RAND_UNTEN, x2: RAND_LINKS, y2: oben,
    breite: 0.8, farbe: SCHWARZ,
  });

  const linienzug = (feld: 'hMin_prozent' | 'hMax_prozent', farbe: Farbe): void => {
    for (let i = 0; i < kurve.length - 1; i += 1) {
      const a = kurve[i]!;
      const b = kurve[i + 1]!;
      elemente.push({
        art: 'linie', x1: xVon(a.v_rappen), y1: yVon(a[feld]),
        x2: xVon(b.v_rappen), y2: yVon(b[feld]), breite: 1.2, farbe,
      });
    }
  };
  linienzug('hMax_prozent', FARBE_MAX);
  linienzug('hMin_prozent', FARBE_MIN);

  // Stuetzstellen als Quadrate auf beiden Randkurven: Sie zeigen, wo die stueckweise
  // Interpolation ihre Steigung wechselt.
  for (const s of opt.stuetzstellen) {
    if (s.v < vVon || s.v > vBis) continue;
    const x = xVon(s.v);
    for (const [wert, farbe] of [
      [(s.hMin / s.v) * 100, FARBE_MIN] as const,
      [(s.hMax / s.v) * 100, FARBE_MAX] as const,
    ]) {
      elemente.push({
        art: 'rechteck', x: x - 2, y: yVon(wert) - 2, breite: 4, hoehe: 4, fuellung: farbe,
      });
    }
  }

  if (opt.markierung !== null) {
    const x = xVon(opt.markierung.v_rappen);
    elemente.push({
      art: 'linie', x1: x, y1: RAND_UNTEN, x2: x, y2: oben, breite: 1, farbe: FARBE_MARKE,
    });
    elemente.push({
      art: 'text', x: Math.min(x + 5, BREITE - 250), y: oben - 9, groesse: 7,
      inhalt: opt.markierung.beschriftung, farbe: FARBE_MARKE,
    });
  }

  elemente.push({
    art: 'text', x: RAND_LINKS, y: HOEHE - 20, groesse: 11, inhalt: opt.titel, farbe: SCHWARZ,
  });
  const legende: readonly (readonly [Farbe, string])[] = [
    [FARBE_MAX, 'Obergrenze H_max(V)/V'],
    [FARBE_MIN, 'Untergrenze H_min(V)/V'],
    [FARBE_BAND, 'Honorarrange'],
  ];
  let xLegende = RAND_LINKS;
  for (const [farbe, text] of legende) {
    elemente.push({
      art: 'rechteck', x: xLegende, y: HOEHE - 40, breite: 8, hoehe: 6, fuellung: farbe,
    });
    elemente.push({
      art: 'text', x: xLegende + 12, y: HOEHE - 39, groesse: 7, inhalt: text, farbe: SCHWARZ,
    });
    xLegende += 24 + text.length * 3.6;
  }
  elemente.push({
    art: 'text', x: 8, y: oben + 8, groesse: 7,
    inhalt: 'Honoraranteil in % der Verkaufssumme (Honorarbasis ohne Aufwandskalierung g(D))',
    farbe: SCHWARZ,
  });
  elemente.push({
    art: 'text', x: RAND_LINKS, y: 14, groesse: 7,
    inhalt: 'Verkaufssumme V in Mio. CHF (logarithmisch; erste bis letzte Stützstelle mit V > 0)',
    farbe: SCHWARZ,
  });

  return { breite: BREITE, hoehe: HOEHE, elemente };
}
