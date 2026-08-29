// Reine Entscheidungslogik von `schluessel-wert-liste.tsx`, getrennt von der Komponente,
// damit die Leerschluessel-Sperre ohne DOM-Ereignisse testbar ist (Muster `zellen-logik.ts`).

// Liefert `undefined`, wenn der (getrimmte) Schluessel leer ist — der Aufrufer ruft `aendere`
// dann nicht auf. Ein bereits vorhandener Schluessel wird ueberschrieben (Upsert).
export function naechsteEintraegeNachHinzufuegen(
  eintraege: Readonly<Record<string, string>>,
  neuerSchluessel: string,
  neuerWert: string,
): Readonly<Record<string, string>> | undefined {
  const schluessel = neuerSchluessel.trim();
  if (schluessel.length === 0) return undefined;
  return { ...eintraege, [schluessel]: neuerWert };
}

// Schluessel wird NICHT getrimmt — er stammt aus dem Bestand selbst, ein Trimmen koennte
// einen real vorhandenen Schluessel verfehlen und die Zeile unloeschbar machen. Ein
// unbekannter Schluessel liefert eine unveraenderte Kopie statt eines Fehlers.
export function naechsteEintraegeNachEntfernen(
  eintraege: Readonly<Record<string, string>>,
  schluessel: string,
): Readonly<Record<string, string>> {
  const { [schluessel]: _entfernt, ...rest } = eintraege;
  return rest;
}

// Wert wird NICHT getrimmt: ein leerer Wert ist ein zulaessiger Zwischenstand beim Tippen.
// Ein unbekannter Schluessel legt den Eintrag an (dieselbe Upsert-Semantik wie beim
// Hinzufuegen).
export function naechsteEintraegeNachWertaenderung(
  eintraege: Readonly<Record<string, string>>,
  schluessel: string,
  wert: string,
): Readonly<Record<string, string>> {
  return { ...eintraege, [schluessel]: wert };
}
