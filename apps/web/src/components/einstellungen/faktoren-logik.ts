/**
 * Reine Entscheidungslogik des Aufwandfaktoren-Editors (Task 16), getrennt von
 * `FaktorenEditor.tsx`, damit sie ohne DOM/React testbar ist (gleiches Muster wie
 * `zellen-logik.ts`).
 */

const GEWICHT_PRAEZISION = 4;

/**
 * Skaliert alle Gewichte proportional auf Summe 1; rundet auf 4 Nachkommastellen und
 * legt die verbleibende Restdifferenz (Rundungsfehler) auf den GROESSTEN Eintrag — die
 * Summe landet damit innerhalb von `GEWICHTSSUMME_TOLERANZ` (`1e-9`,
 * `packages/core/src/config/ebene3.ts`) auf 1, dem Massstab, an dem `CFG_WEIGHTS_SUM`
 * tatsaechlich prueft; kein gerundetes "fast 1" ausserhalb dieser Toleranz. Wegen
 * IEEE-754 (`Math.round(x * 10000) / 10000` plus die Float-Addition der Restdifferenz)
 * ist die Summe NICHT immer bitgenau `1` — bei einem Teil der moeglichen Eingaben
 * bleibt eine Abweichung im Bereich eines ULP (~2.22e-16), weit innerhalb der Toleranz
 * und damit fuer `CFG_WEIGHTS_SUM` folgenlos. Ein Eintrag mit Gewicht 0 bleibt 0
 * (0/Summe * Summe = 0), das ist die gewuenschte Ruhelage eines frisch hinzugefuegten,
 * noch ungewichteten Faktors.
 *
 * Ist die Ausgangssumme 0 (alle Faktoren auf 0, oder keine Faktoren), gibt es nichts
 * proportional zu verteilen — die Eingabe kommt unveraendert zurueck, statt durch 0 zu
 * teilen.
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

  // Groesster Eintrag traegt die Restdifferenz — bei Gleichstand der erste in
  // Objektreihenfolge (deterministisch, kein Sortiereffekt auf die Faktorliste).
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
 * Rohgeruest eines neuen manuellen Faktors: `minmax`-Strategie, Grenzen 1..6 (die in
 * der Konfiguration uebliche Skala fuer manuell erfasste Faktoren, siehe die
 * bestehenden `minmax`-Faktoren in der Standardkonfiguration), Gewicht 0 — Gewicht 0
 * haelt die Gewichtssumme unveraendert gueltig, bis der Auftraggeber den neuen Faktor
 * bewusst gewichtet (und danach `renormalisiereGewichte` aufruft).
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
