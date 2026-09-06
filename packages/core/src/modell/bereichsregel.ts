// Keine Formel.
// Staffel aus exklusiven Obergrenzen: erster Treffer mit merkmalswert < unter
// gewinnt; Eintrag ohne unter ist Restfall am Schluss. Schliesst Luecken/
// Ueberlappungen per Konstruktion aus. Bewusst keine Ausdruckssprache.

export interface Bereich {
  readonly unter?: number;
  readonly wert: number;
}

export interface Bereichsregel {
  readonly merkmal: string;
  readonly bereiche: readonly Bereich[];
}

export interface Bereichstreffer {
  readonly wert: number;
  // 0-basiert, wandert als Nachweis ins Artefakt.
  readonly bereich: number;
}

// Noetig wegen exactOptionalPropertyTypes: z.number().optional() infert
// unter?: number | undefined, Bereich.unter erlaubt das nicht explizit.
export function normalisiereBereiche(
  bereiche: readonly { readonly unter?: number | undefined; readonly wert: number }[],
): readonly Bereich[] {
  return bereiche.map((b) => (b.unter === undefined ? { wert: b.wert } : { unter: b.unter, wert: b.wert }));
}

// Leeres Ergebnis heisst gueltig; sonst je Befund ein Satz fuer die Fehlermeldung.
export function pruefeBereiche(bereiche: readonly Bereich[]): readonly string[] {
  const gruende: string[] = [];

  if (bereiche.length === 0) {
    return ['Die Staffel enthaelt keinen Bereich.'];
  }

  const restfallIndizes = bereiche
    .map((b, i) => (b.unter === undefined ? i : -1))
    .filter((i) => i >= 0);

  if (restfallIndizes.length === 0) {
    gruende.push('Die Staffel hat keinen Restfall (Eintrag ohne `unter`).');
  } else if (restfallIndizes.length > 1) {
    gruende.push('Die Staffel hat mehr als einen Restfall.');
  } else if (restfallIndizes[0] !== bereiche.length - 1) {
    gruende.push('Der Restfall steht nicht am Schluss der Staffel.');
  }

  let vorige: number | undefined;
  bereiche.forEach((b, i) => {
    if (!Number.isFinite(b.wert)) {
      gruende.push(`Bereich ${i}: der Wert ist keine endliche Zahl.`);
    }
    if (b.unter === undefined) return;
    if (!Number.isFinite(b.unter)) {
      gruende.push(`Bereich ${i}: die Schwelle ist keine endliche Zahl.`);
      return;
    }
    if (vorige !== undefined && b.unter <= vorige) {
      gruende.push(`Bereich ${i}: die Schwellen sind nicht streng aufsteigend.`);
    }
    vorige = b.unter;
  });

  return gruende;
}

// Nur fuer Staffeln definiert, die pruefeBereiche akzeptiert; ausserhalb davon
// (z. B. fehlender Restfall) ist der Aufruf ein Programmierfehler und schlaegt
// laut fehl, statt einen falschen Wert zu liefern.
export function werteBereichsregelAus(
  regel: Bereichsregel,
  merkmalswert: number,
): Bereichstreffer {
  for (let i = 0; i < regel.bereiche.length; i += 1) {
    const b = regel.bereiche[i]!;
    if (b.unter === undefined || merkmalswert < b.unter) {
      return { wert: b.wert, bereich: i };
    }
  }
  throw new Error('Die Staffel hat keinen Restfall und kann nicht ausgewertet werden — pruefeBereiche muss aufgerufen werden.');
}
