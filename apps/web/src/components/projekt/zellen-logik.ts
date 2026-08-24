/**
 * Reine Entscheidungslogik der Einheitentabelle, getrennt von den React-Komponenten
 * (`ZellenEingabe.tsx`, `EinheitenTabelle.tsx`), damit sie ohne DOM-Ereignisse testbar
 * ist. `renderToStaticMarkup` haengt keine Handler an — ein reiner Rendering-Test haette
 * also nie gezeigt, dass ein geleertes Feld faelschlich auf 0 fiel (Task-11-Review,
 * Finding 4).
 */

export type Zellentscheid =
  | { readonly art: 'uebernehmen'; readonly wert: number }
  | { readonly art: 'verwerfen' };

/**
 * Entscheidet beim Verlassen eines Zahlenfelds, ob der Entwurf uebernommen wird.
 *
 * `Number('')` ist `0`, und `Number.isFinite(0)` ist wahr — ein blosser
 * `Number.isFinite`-Test uebersieht deshalb genau den Fall, den er abfangen soll: ein
 * geleertes Feld. Ein leerer (nach Trim) oder nicht parsierbarer Entwurf — ein
 * einzelnes Minus, ein deutsches Komma statt Punkt — verwirft daher, statt eine `0` zu
 * erfinden. Der Aufrufer laesst bei `verwerfen` den bisherigen Wert stehen.
 */
export function entscheideZellenwert(entwurf: string): Zellentscheid {
  const bereinigt = entwurf.trim();
  if (bereinigt.length === 0) return { art: 'verwerfen' };
  const zahl = Number(bereinigt);
  return Number.isFinite(zahl) ? { art: 'uebernehmen', wert: zahl } : { art: 'verwerfen' };
}

// Genug Nachkommastellen, um Gleitkomma-Rauschen (0.07 * 100 === 7.000000000000001) beim
// Runden zu verschlucken, ohne echte Prozent-Praezision zu verlieren.
const PROZENT_PRAEZISION = 1e6;

/**
 * Faktor (0.05) -> Prozentzahl fuer die Anzeige (5).
 *
 * Reine Anzeigeumrechnung eines dimensionslosen Faktors, keine Rappen-Rundungsstelle
 * (E-09 betrifft Franken/Rappen, nicht diese Umrechnung). `projektion.ts` nimmt den
 * gespeicherten `spaltenwerte`-Wert unveraendert als Faktor — die Kolonnen-Ueberschrift
 * "(%)" waere sonst falsch: `5` eingegeben hiesse `500%` statt `5%`.
 */
export function faktorZuProzent(faktor: number): number {
  return Math.round(faktor * 100 * PROZENT_PRAEZISION) / PROZENT_PRAEZISION;
}

/** Prozentzahl (5) -> Faktor fuer die Ablage (0.05). Kehrt `faktorZuProzent` um. */
export function prozentZuFaktor(prozent: number): number {
  return Math.round((prozent / 100) * PROZENT_PRAEZISION) / PROZENT_PRAEZISION;
}

/**
 * Ob eine manuelle Position mit dieser Begruendung angelegt werden darf.
 *
 * Spiegelt `erfassungsSchema`s Mindestlaenge (`begruendungMinLaenge`, US-04), statt sie
 * zu duplizieren: die Zahl kommt als Parameter von der Konfiguration des Aufrufers, nicht
 * fest verdrahtet — sonst entstuende ein zweiter, driftender Regelort.
 */
export function istBegruendungGueltig(begruendung: string, minLaenge: number): boolean {
  return begruendung.trim().length >= minLaenge;
}
