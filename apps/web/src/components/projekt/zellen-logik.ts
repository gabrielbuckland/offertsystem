export type Zellentscheid =
  | { readonly art: 'uebernehmen'; readonly wert: number }
  | { readonly art: 'verwerfen' };

// Number('') ist 0, und Number.isFinite(0) ist wahr — ein blosser Number.isFinite-Test
// uebersieht deshalb genau das geleerte Feld, das er abfangen soll. Verwirft daher bei
// leerem/nicht parsierbarem Entwurf statt eine 0 zu erfinden; der Aufrufer laesst bei
// verwerfen den bisherigen Wert stehen.
export function entscheideZellenwert(entwurf: string): Zellentscheid {
  const bereinigt = entwurf.trim();
  if (bereinigt.length === 0) return { art: 'verwerfen' };
  const zahl = Number(bereinigt);
  return Number.isFinite(zahl) ? { art: 'uebernehmen', wert: zahl } : { art: 'verwerfen' };
}

// Genug Nachkommastellen, um Gleitkomma-Rauschen (0.07 * 100 === 7.000000000000001) beim
// Runden zu verschlucken, ohne echte Prozent-Praezision zu verlieren.
const PROZENT_PRAEZISION = 1e6;

// Faktor (0.05) -> Prozentzahl fuer die Anzeige (5). Der gespeicherte spaltenwerte-Wert
// bleibt unveraendert als Faktor — die Kolonnen-Ueberschrift "(%)" waere sonst falsch.
// Keine Rappen-Rundungsstelle: E-09 betrifft Franken/Rappen, nicht diese Umrechnung.
export function faktorZuProzent(faktor: number): number {
  return Math.round(faktor * 100 * PROZENT_PRAEZISION) / PROZENT_PRAEZISION;
}

export function prozentZuFaktor(prozent: number): number {
  return Math.round((prozent / 100) * PROZENT_PRAEZISION) / PROZENT_PRAEZISION;
}

export function rappenZuFranken(rappen: number): number {
  return rappen / 100;
}

// Math.round statt Kuerzen: erfassterBetrag ist ganzzahlig (z.number().int()), eine nicht
// gerundete Kommazahl faellt sonst bei der Schemapruefung durch (IEEE-754-Rauschen wie
// 19.99 * 100 === 1998.9999999999998).
export function frankenZuRappen(franken: number): number {
  return Math.round(franken * 100);
}
