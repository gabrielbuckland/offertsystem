/**
 * Keine Formel. Bildet einen numerischen Merkmalswert auf einen Zu-/Abschlagswert ab.
 *
 * Die Staffel ist eine Liste exklusiver Obergrenzen: der erste Bereich mit
 * `merkmalswert < unter` gewinnt, der Eintrag ohne `unter` ist der Restfall und steht
 * zwingend am Schluss. Diese Schreibweise stammt aus dem Excel des Auftraggebers
 * («unter 1 kein Zuschlag, unter 2 dann 100») und kann per Konstruktion weder eine
 * Luecke noch eine Ueberlappung enthalten — eine ganze Fehlerklasse entfaellt, statt
 * geprueft zu werden.
 *
 * Bewusst KEINE Ausdruckssprache: Eine Tabelle ist konfigurierbar, ein Ausdruck waere
 * Code in der Konfiguration (Kapitel 3, tab:architekturalternativen).
 */

export interface Bereich {
  /** Exklusive Obergrenze. Fehlt beim Restfall. */
  readonly unter?: number;
  readonly wert: number;
}

export interface Bereichsregel {
  readonly merkmal: string;
  readonly bereiche: readonly Bereich[];
}

export interface Bereichstreffer {
  readonly wert: number;
  /** Index des getroffenen Bereichs, 0-basiert — wandert als Nachweis ins Artefakt. */
  readonly bereich: number;
}

/**
 * Normalisiert Rohbereiche (aus Zod-Schema oder serialisierter Kopie) auf `Bereich`.
 *
 * Ausschliesslich fuer `exactOptionalPropertyTypes` noetig: `z.number().optional()`
 * infert `unter?: number | undefined`, waehrend `Bereich.unter` als blosses `unter?:
 * number` ohne explizites `undefined` im Wertebereich gilt. Einzige Definition dieser
 * Umformung — Aufrufstellen in `config/abbildung.ts`, `config/ebene3.ts` und
 * `pipeline/serialisierung.ts` duplizieren sie nicht mehr, sondern rufen sie auf.
 */
export function normalisiereBereiche(
  bereiche: readonly { readonly unter?: number | undefined; readonly wert: number }[],
): readonly Bereich[] {
  return bereiche.map((b) => (b.unter === undefined ? { wert: b.wert } : { unter: b.unter, wert: b.wert }));
}

/** Leeres Ergebnis heisst gueltig; sonst je Befund ein Satz fuer die Fehlermeldung. */
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

/**
 * Total und fehlerfrei ueber jede Staffel, die pruefeBereiche akzeptiert.
 *
 * Fuer jede gueltige Staffel und jeden endlichen Merkmalswert entsteht genau ein
 * Treffer. Der Restfall garantiert das — deshalb ist er Pflicht und kein Komfort.
 *
 * Ausserhalb der durch pruefeBereiche definierten Domäne (z. B. leere Staffel oder
 * fehlender Restfall) ist der Aufruf ein Programmierungsfehler und schlaegt laut fehl,
 * statt einen falschen Wert zu liefern. pruefeBereiche muss vorher aufgerufen werden.
 */
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
