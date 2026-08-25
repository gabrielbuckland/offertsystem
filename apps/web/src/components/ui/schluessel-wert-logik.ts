/**
 * Reine Entscheidungslogik von `schluessel-wert-liste.tsx`, getrennt von der Komponente,
 * damit die Leerschluessel-Sperre ohne DOM-Ereignisse testbar ist (Muster `zellen-logik.ts`
 * neben `ZellenEingabe.tsx`): `renderToStaticMarkup` haengt keine Handler an — ein reiner
 * Rendering-Test koennte also nie zeigen, dass ein leerer (bzw. nur aus Leerzeichen
 * bestehender) Schluessel beim Hinzufuegen abgewiesen wird.
 */

/**
 * Berechnet den naechsten Eintraege-Stand nach «Eintrag hinzufügen», oder `undefined`,
 * wenn der (getrimmte) Schluessel leer ist — dann bleibt der bisherige Stand unveraendert,
 * der Aufrufer ruft `aendere` in diesem Fall nicht auf. Ein bereits vorhandener Schluessel
 * wird ueberschrieben (Upsert), nicht abgewiesen — derselbe Schluessel im Formular meint
 * denselben Eintrag.
 */
export function naechsteEintraegeNachHinzufuegen(
  eintraege: Readonly<Record<string, string>>,
  neuerSchluessel: string,
  neuerWert: string,
): Readonly<Record<string, string>> | undefined {
  const schluessel = neuerSchluessel.trim();
  if (schluessel.length === 0) return undefined;
  return { ...eintraege, [schluessel]: neuerWert };
}

/**
 * Berechnet den naechsten Eintraege-Stand nach «entfernen». Der Schluessel wird NICHT
 * getrimmt — anders als beim Hinzufuegen stammt er hier aus dem Bestand selbst, nicht aus
 * einer Eingabe; ein Trimmen koennte einen real vorhandenen Schluessel verfehlen und die
 * Zeile unloeschbar machen.
 *
 * Ein unbekannter Schluessel liefert eine unveraenderte Kopie statt eines Fehlers: Die
 * Schaltflaeche entsteht je Bestandszeile, ein Fehlgriff ist also kein Bedienfehler,
 * sondern hoechstens ein veralteter Stand — und dessen richtige Antwort ist «nichts zu tun».
 */
export function naechsteEintraegeNachEntfernen(
  eintraege: Readonly<Record<string, string>>,
  schluessel: string,
): Readonly<Record<string, string>> {
  const { [schluessel]: _entfernt, ...rest } = eintraege;
  return rest;
}

/**
 * Berechnet den naechsten Eintraege-Stand nach dem Bearbeiten eines bestehenden Werts.
 *
 * Der Schluessel bleibt fixiert (das Schluesselfeld ist `readOnly`), der Wert wird
 * unveraendert uebernommen — insbesondere NICHT getrimmt und nicht auf Leere geprueft:
 * Ein leerer Wert ist ein zulaessiger Zwischenstand beim Tippen, und ein Trimmen
 * verhinderte das Eintippen eines Leerzeichens innerhalb des Werts.
 *
 * Ein unbekannter Schluessel legt den Eintrag an. Das ist gewollt und dieselbe
 * Upsert-Semantik wie beim Hinzufuegen — der Record ist offen, und zwei verschiedene
 * Regeln fuer dieselbe Zuweisung waeren die teurere Abweichungsquelle.
 */
export function naechsteEintraegeNachWertaenderung(
  eintraege: Readonly<Record<string, string>>,
  schluessel: string,
  wert: string,
): Readonly<Record<string, string>> {
  return { ...eintraege, [schluessel]: wert };
}
