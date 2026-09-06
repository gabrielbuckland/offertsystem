// Keine Modellformel. null statt Infinity/NaN: ein nicht definierter Wert soll im
// Artefakt als nicht definiert erscheinen, nicht als Zahl, die wie ein Messwert aussieht.

export function relativeAenderungProzent(basis: number, neu: number): number | null {
  if (basis === 0) return neu === 0 ? 0 : null;
  return ((neu - basis) / basis) * 100;
}

export function sichereDivision(zaehler: number, nenner: number): number | null {
  if (nenner === 0) return null;
  const wert = zaehler / nenner;
  return Number.isFinite(wert) ? wert : null;
}

export function prozentFuerArtefakt(wert: number | null): number | null {
  return wert === null ? null : Math.round(wert * 1e4) / 1e4;
}
