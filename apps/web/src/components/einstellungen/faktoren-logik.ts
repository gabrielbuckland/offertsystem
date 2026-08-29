// Reine Entscheidungslogik des Aufwandfaktoren-Editors, getrennt von `FaktorenEditor.tsx`,
// damit sie ohne DOM/React testbar ist (gleiches Muster wie `zellen-logik.ts`).

const GEWICHT_PRAEZISION = 4;

/**
 * Skaliert alle Gewichte proportional auf Summe 1; rundet auf 4 Nachkommastellen und legt
 * die Restdifferenz auf den GROESSTEN Eintrag, damit die Summe innerhalb
 * `GEWICHTSSUMME_TOLERANZ` (`1e-9`, `packages/core/src/config/ebene3.ts`) liegt. Wegen
 * IEEE-754 ist die Summe nicht immer bitgenau 1, eine Abweichung im Bereich eines ULP
 * bleibt aber innerhalb der Toleranz. Ausgangssumme 0 kommt unveraendert zurueck, statt
 * durch 0 zu teilen.
 */
export function renormalisiereGewichte<T extends { readonly gewicht: number }>(
  faktoren: Readonly<Record<string, T>>,
): Readonly<Record<string, T>> {
  const eintraege = Object.entries(faktoren);
  const summe = eintraege.reduce((wert, [, faktor]) => wert + faktor.gewicht, 0);
  if (summe === 0) return faktoren;

  const skaliert = eintraege.map(([schluessel, faktor]) => {
    const roh = (faktor.gewicht / summe);
    const gerundet = Math.round(roh * 10 ** GEWICHT_PRAEZISION) / 10 ** GEWICHT_PRAEZISION;
    return { schluessel, faktor, gewicht: gerundet };
  });

  const zwischensumme = skaliert.reduce((wert, e) => wert + e.gewicht, 0);
  const restdifferenz = Math.round((1 - zwischensumme) * 10 ** GEWICHT_PRAEZISION) / 10 ** GEWICHT_PRAEZISION;

  // Bei Gleichstand traegt der erste Eintrag die Restdifferenz (deterministisch).
  let groessterIndex = 0;
  for (let i = 1; i < skaliert.length; i += 1) {
    if (skaliert[i]!.gewicht > skaliert[groessterIndex]!.gewicht) groessterIndex = i;
  }

  const ergebnis: Record<string, T> = {};
  skaliert.forEach((eintrag, i) => {
    const gewicht = i === groessterIndex ? eintrag.gewicht + restdifferenz : eintrag.gewicht;
    ergebnis[eintrag.schluessel] = { ...eintrag.faktor, gewicht };
  });
  return ergebnis;
}

/**
 * Rohgeruest eines neuen manuellen Faktors: Grenzen 1..6 (uebliche Skala manuell
 * erfasster Faktoren), Gewicht 0 haelt die Gewichtssumme gueltig, bis der Auftraggeber
 * bewusst gewichtet.
 */
export function neuerManuellerFaktor(schluessel: string): {
  bezeichnung: string; quelle: 'manuell'; quellSchluessel: string;
  strategie: 'minmax'; min: number; max: number; gewicht: number;
} {
  return {
    bezeichnung: schluessel,
    quelle: 'manuell',
    quellSchluessel: schluessel,
    strategie: 'minmax',
    min: 1,
    max: 6,
    gewicht: 0,
  };
}
