/**
 * Keine Formel. Zustand und Uebergaenge der siebenschrittigen Erfassung.
 *
 * Der Reduzierer ist eine REINE Funktion und deshalb ohne Oberflaechentest pruefbar —
 * genau die Aufteilung, die den Verzicht aus Kapitel 4.4 traegt, ohne die Bedienlogik
 * ungeprueft zu lassen.
 *
 * Schritt 6 (Aufwandfaktoren) steht nach Schritt 5, weil die abgeleiteten Faktoren von
 * der Einheitenzahl und vom flaechengewichteten mittleren Quadratmeterpreis abhaengen
 * (Quelle `abgeleitet`, E-06) — die Reihenfolge folgt den Berechnungsabhaengigkeiten,
 * nicht der Bequemlichkeit.
 */
import type { BewertungsBuendel, Konfiguration, Lagescores } from '@offert/core';
import { baueFaktorformular, pruefeFaktorwerte } from '../../server/faktorformular.js';
import { pruefeErfassung, type Feldmeldung } from '../../server/feldmeldungen.js';

export interface Schrittbeschreibung {
  readonly nummer: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly titel: string;
}

export const SCHRITTE: readonly Schrittbeschreibung[] = [
  { nummer: 1, titel: 'Liegenschaftsdaten' },
  { nummer: 2, titel: 'Wohnungstypen' },
  { nummer: 3, titel: 'Bewertungsabruf' },
  { nummer: 4, titel: 'Einheiten' },
  { nummer: 5, titel: 'Zu- und Abschläge' },
  { nummer: 6, titel: 'Aufwandfaktoren' },
  { nummer: 7, titel: 'Ergebnis' },
];

export type Schrittnummer = Schrittbeschreibung['nummer'];

export interface AblaufZustand {
  readonly aktiverSchritt: Schrittnummer;
  readonly konfiguration: Konfiguration;
  readonly projekt: Record<string, unknown>;
  readonly liegenschaft: Record<string, unknown>;
  readonly wohnungstypen: readonly Record<string, unknown>[];
  readonly einheiten: readonly Record<string, unknown>[];
  readonly aufwandfaktoren: Readonly<Record<string, number>>;
  readonly bewertungen?: BewertungsBuendel | undefined;
  readonly lagescores?: Lagescores | undefined;
  readonly meldungen: readonly Feldmeldung[];
  readonly blockade?: string | undefined;
  readonly hinweis?: string | undefined;
}

export type Aktion =
  | { art: 'weiter' }
  | { art: 'zurueck' }
  | { art: 'springe'; ziel: Schrittnummer }
  | { art: 'setze'; pfad: string; wert: unknown }
  | { art: 'typHinzu' }
  | { art: 'typEntfernen'; index: number }
  | { art: 'einheitHinzu' }
  | { art: 'einheitEntfernen'; index: number }
  | { art: 'bewertungenEingetroffen'; buendel: BewertungsBuendel; lagescores: Lagescores };

/** Feldpfad-Praefixe je Schritt; reine Zuordnung, keine Fachregel. */
const PFADE_JE_SCHRITT: Readonly<Record<Schrittnummer, readonly string[]>> = {
  1: ['projekt', 'liegenschaft'],
  2: ['wohnungstypen'],
  3: [],
  4: ['einheiten'],
  5: ['einheiten'],
  6: ['aufwandfaktoren'],
  7: [],
};

/**
 * Neuer Wohnungstyp mit leerer Parametrisierung. Die Felder entsprechen der
 * verbindlichen Liste aus RepraesentativeParametrisierung (E-28); befuellt werden sie
 * in Schritt 2.
 *
 * Der Bezeichner wird fortlaufend vergeben und NICHT aus der Zimmerzahl abgeleitet,
 * obwohl die Fixtures diese Schreibweise fuehren: Die Zimmerzahl ist in Schritt 2
 * aenderbar, und ein mitwanderneder Bezeichner risse die in Schritt 4 gesetzten
 * Typbezuege der Einheiten. Die Regel `je Zimmerzahl genau ein Wohnungstyp` haengt am
 * Wert, nicht am Bezeichner, und wird von der Erfassungspruefung durchgesetzt.
 *
 * Vergeben wird oberhalb des hoechsten bereits benutzten Zaehlers, damit ein Bezeichner
 * nach dem Entfernen eines Typs nicht erneut vergeben wird.
 */
function leererWohnungstyp(vorhandene: readonly Record<string, unknown>[]): Record<string, unknown> {
  const hoechste = vorhandene.reduce((max, typ) => {
    const treffer = /^T(\d+)$/.exec(String(typ['id'] ?? ''));
    return treffer === null ? max : Math.max(max, Number(treffer[1]));
  }, 0);
  return {
    id: `T${hoechste + 1}`,
    zimmerzahl: 0,
    parametrisierung: {
      flaecheInnen: 0, flaecheAussen: 0, stockwerk: 0, energielabel: '',
      zustandsbewertungen: {}, qualitaetsbewertungen: {},
      anzahlBadezimmer: 0, lift: false, baujahr: 0, heizungsart: '',
    },
  };
}

function leereEinheit(): Record<string, unknown> {
  return {
    wohnungsnummer: '', wohnungstypId: '', flaecheInnen: 0, flaecheAussen: 0,
    stockwerk: 0, anpassungen: [],
  };
}

/** Schreibt einen Wert an einen punktgetrennten Pfad in eine Tiefkopie. */
export function setzeAmPfad(
  zustand: AblaufZustand, pfad: string, wert: unknown,
): AblaufZustand {
  const teile = pfad.split('.');
  const kopie = structuredClone(zustand) as unknown as Record<string, unknown>;
  let knoten: Record<string, unknown> = kopie;
  for (const teil of teile.slice(0, -1)) {
    const naechster = knoten[teil];
    if (typeof naechster !== 'object' || naechster === null) return zustand;
    knoten = naechster as Record<string, unknown>;
  }
  const letzter = teile[teile.length - 1];
  if (letzter === undefined) return zustand;
  knoten[letzter] = wert;
  // Die Konfiguration ist beim Klonen verloren gegangen (Map-Felder); sie wird nicht
  // erfasst und deshalb aus dem Ausgangszustand uebernommen.
  return { ...(kopie as unknown as AblaufZustand), konfiguration: zustand.konfiguration };
}

/** Filtert die Befunde auf die Feldpfade des jeweiligen Schritts. */
export function meldungenFuerSchritt(
  zustand: AblaufZustand, schritt: Schrittnummer,
): readonly Feldmeldung[] {
  const praefixe = PFADE_JE_SCHRITT[schritt];
  if (praefixe.length === 0) return [];
  const erfassung = {
    projekt: zustand.projekt,
    liegenschaft: zustand.liegenschaft,
    wohnungstypen: zustand.wohnungstypen,
    einheiten: zustand.einheiten,
    aufwandfaktoren: zustand.aufwandfaktoren,
  };
  const alle = schritt === 6
    ? pruefeFaktorwerte(baueFaktorformular(zustand.konfiguration), zustand.aufwandfaktoren)
    : pruefeErfassung(erfassung, zustand.konfiguration);
  return alle.filter((m) => praefixe.some((p) => m.feldpfad === p || m.feldpfad.startsWith(`${p}.`)));
}

export function reduziere(z: AblaufZustand, a: Aktion): AblaufZustand {
  switch (a.art) {
    case 'setze':
      return { ...setzeAmPfad(z, a.pfad, a.wert), blockade: undefined, hinweis: undefined };
    case 'typHinzu':
      return { ...z, wohnungstypen: [...z.wohnungstypen, leererWohnungstyp(z.wohnungstypen)] };
    case 'typEntfernen':
      return { ...z, wohnungstypen: z.wohnungstypen.filter((_, i) => i !== a.index) };
    case 'einheitHinzu':
      return { ...z, einheiten: [...z.einheiten, leereEinheit()] };
    case 'einheitEntfernen':
      return { ...z, einheiten: z.einheiten.filter((_, i) => i !== a.index) };
    case 'bewertungenEingetroffen':
      // PE-23: Ein unvollstaendiges Buendel wird gefuehrt und gekennzeichnet, aber nicht
      // weiterverarbeitet — der Ablauf bleibt in Schritt 3 stehen (US-15, NFA-10, I-24).
      return {
        ...z,
        bewertungen: a.buendel,
        lagescores: a.lagescores,
        aktiverSchritt: a.buendel.vollstaendig ? 4 : 3,
        blockade: a.buendel.vollstaendig
          ? undefined
          : 'Für mindestens einen Wohnungstyp liegt keine Bewertung vor. '
            + 'Ohne vollständiges Bewertungsergebnis wird nicht gerechnet und '
            + 'keine Offerte erzeugt.',
      };
    case 'zurueck':
      return {
        ...z,
        aktiverSchritt: Math.max(1, z.aktiverSchritt - 1) as Schrittnummer,
        blockade: undefined,
      };
    case 'weiter': {
      const offene = meldungenFuerSchritt(z, z.aktiverSchritt);
      if (offene.length > 0) {
        return {
          ...z,
          meldungen: offene,
          blockade: `Schritt ${z.aktiverSchritt} enthält ${offene.length} offene `
            + 'Punkte. Bitte die markierten Felder korrigieren.',
        };
      }
      return {
        ...z,
        meldungen: [],
        blockade: undefined,
        aktiverSchritt: Math.min(7, z.aktiverSchritt + 1) as Schrittnummer,
      };
    }
    case 'springe': {
      // I-24: Ein Ruecksprung auf die Typparametrisierung entwertet die Bewertungen
      // sichtbar, statt eine veraltete Bewertung stillschweigend weiterzuverwenden.
      const entwertet = a.ziel <= 2 && z.bewertungen !== undefined;
      return {
        ...z,
        aktiverSchritt: a.ziel,
        bewertungen: entwertet ? undefined : z.bewertungen,
        lagescores: entwertet ? undefined : z.lagescores,
        blockade: undefined,
        hinweis: entwertet
          ? 'Die Änderung der Parametrisierung entwertet die bezogenen Bewertungen. '
            + 'Der Bewertungsabruf ist zu wiederholen.'
          : undefined,
      };
    }
  }
}
