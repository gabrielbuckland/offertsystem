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
