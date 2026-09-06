// Editor und Rechenweg lesen diese Beschriftungen aus derselben Quelle, damit ein Wert
// nicht an einer Stelle beschriftet und an der anderen roh erscheint.
import { QUALITAETSWERTE, ZUSTANDSWERTE, type Bewertungsfeld } from '@offert/core';

export const FELD_BESCHRIFTUNG: Readonly<Record<Bewertungsfeld, string>> = {
  bathrooms: 'Badezimmer',
  kitchen: 'Küche',
  flooring: 'Böden',
  windows: 'Fenster',
};

const ZUSTAND_BESCHRIFTUNG: Readonly<Record<string, string>> = {
  renovation_needed: 'Renovationsbedarf',
  well_maintained: 'Gepflegt',
  new_or_recently_renovated: 'Neu oder kürzlich renoviert',
};

const QUALITAET_BESCHRIFTUNG: Readonly<Record<string, string>> = {
  simple: 'Einfach',
  normal: 'Normal',
  high_quality: 'Gehoben',
  luxury: 'Luxus',
};

export interface Bewertungsobjekt {
  readonly beschriftung: string;
  readonly werte: readonly string[];
  readonly wertBeschriftung: Readonly<Record<string, string>>;
}

export const BEWERTUNGSOBJEKTE: Readonly<Record<string, Bewertungsobjekt>> = {
  zustandsbewertungen: {
    beschriftung: 'Zustandsbewertungen',
    werte: ZUSTANDSWERTE,
    wertBeschriftung: ZUSTAND_BESCHRIFTUNG,
  },
  qualitaetsbewertungen: {
    beschriftung: 'Qualitätsbewertungen',
    werte: QUALITAETSWERTE,
    wertBeschriftung: QUALITAET_BESCHRIFTUNG,
  },
};

// Fallback auf den Rohschluessel: ein unbeschriftetes Feld bleibt sichtbar statt leer.
export function beschrifteFeld(feld: string): string {
  return FELD_BESCHRIFTUNG[feld as Bewertungsfeld] ?? feld;
}

export function beschrifteObjekt(objektschluessel: string): string {
  return BEWERTUNGSOBJEKTE[objektschluessel]?.beschriftung ?? objektschluessel;
}

export function beschrifteWert(objektschluessel: string, wert: string): string {
  return BEWERTUNGSOBJEKTE[objektschluessel]?.wertBeschriftung[wert] ?? wert;
}
