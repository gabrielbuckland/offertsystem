/**
 * Keine Modellformel. Rechenhilfen der Evaluationswerkzeuge.
 *
 * `null` statt `Infinity` oder `NaN`: Ein nicht definierter Wert soll im Artefakt als
 * nicht definiert erscheinen und nicht als Zahl, die aussieht wie ein Messwert.
 */

/** Relative Aenderung in Prozentpunkten. null, wenn nicht definiert. */
export function relativeAenderungProzent(basis: number, neu: number): number | null {
  if (basis === 0) return neu === 0 ? 0 : null;
  return ((neu - basis) / basis) * 100;
}

/** Division, die statt Infinity/NaN null liefert. */
export function sichereDivision(zaehler: number, nenner: number): number | null {
  if (nenner === 0) return null;
  const wert = zaehler / nenner;
  return Number.isFinite(wert) ? wert : null;
}

/** Auf vier Nachkommastellen gerundeter Prozentwert fuer Artefakte. */
export function prozentFuerArtefakt(wert: number | null): number | null {
  return wert === null ? null : Math.round(wert * 1e4) / 1e4;
}
