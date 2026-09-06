// Keine Formel. Zahlendarstellung und Rundung (E-09, E-10).
// Die Preiskette laeuft in ganzzahligen Rappen als number; die Score-/Gewichtskette
// gleitkommabasiert. Die Marken verhindern zur Uebersetzungszeit, dass ein Frankenbetrag
// mit einem Score verrechnet wird (I-28).
import type { Branded } from './brand.js';

export type Rappen = Branded<number, 'Rappen'>;
export type Quadratmeter = Branded<number, 'Quadratmeter'>;
export type Score = Branded<number, 'Score'>;
export type Gewicht = Branded<number, 'Gewicht'>;

// Einzige Erzeugungsstelle von Rappen aus einem bereits ganzzahligen Wert.
export function rappen(ganzzahligerWert: number): Rappen {
  if (!Number.isInteger(ganzzahligerWert)) {
    throw new Error(`Rappen muss ganzzahlig sein, erhalten: ${ganzzahligerWert}`);
  }
  return ganzzahligerWert as Rappen;
}

// Kaufmaennische Rundung, halbe Betraege vom Nullpunkt weg. Math.round allein ist nicht
// symmetrisch (Math.round(-0.5) === -0); negative Zwischenbetraege treten auf, sobald ein
// Zu-/Abschlag als absoluter Betrag erfasst wurde. Verwendet von R1 (ACL), R2 (Stufe 2)
// und R3 (Stufe 5).
export function rundeAufRappen(betrag: number): Rappen {
  if (!Number.isFinite(betrag)) {
    throw new Error(`Rundung verlangt einen endlichen Betrag, erhalten: ${betrag}`);
  }
  const gerundet = Math.sign(betrag) * Math.round(Math.abs(betrag));
  // -0 wird auf 0 normalisiert, damit tiefe Gleichheit (I-14) haelt.
  return rappen(gerundet === 0 ? 0 : gerundet);
}

// Ausschliesslich fuer die Darstellung. Kein Rechenweg fuehrt hier zurueck.
export function zuFranken(r: Rappen): number {
  return r / 100;
}

export function quadratmeter(wert: number): Quadratmeter {
  if (!Number.isFinite(wert) || wert <= 0) {
    throw new Error(`Quadratmeter muss endlich und groesser als null sein, erhalten: ${wert}`);
  }
  return wert as Quadratmeter;
}

// Zulaessig ab null — Aussenflaeche darf fehlen (US-01).
export function quadratmeterAbNull(wert: number): Quadratmeter {
  if (!Number.isFinite(wert) || wert < 0) {
    throw new Error(`Flaeche muss endlich und nicht negativ sein, erhalten: ${wert}`);
  }
  return wert as Quadratmeter;
}

export function score(wert: number): Score {
  if (!Number.isFinite(wert) || wert < 0 || wert > 1) {
    throw new Error(`Score muss in [0, 1] liegen, erhalten: ${wert}`);
  }
  return wert as Score;
}

export function gewicht(wert: number): Gewicht {
  if (!Number.isFinite(wert) || wert < 0 || wert > 1) {
    throw new Error(`Gewicht muss in [0, 1] liegen, erhalten: ${wert}`);
  }
  return wert as Gewicht;
}
