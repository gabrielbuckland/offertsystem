/**
 * Keine Formel. Platzhalterkatalog der Offerttexte.
 *
 * Die EINE Stelle, an der Berechnungsergebnis und Vorlagentext zusammenkommen. Editor-
 * Einfügemenü (apps/web), Vorlagenvalidierung und Auflösung lesen denselben Katalog.
 *
 * `auftraggeber` stammt bewusst NICHT aus dem Offert-Objekt (kein Empfänger im Schema,
 * siehe model/offer.ts), sondern aus dem Projektfeld; fehlt er, bleibt der Eintrag weg
 * und die Auflösung meldet den Fehler beim Finalisieren (fail fast).
 */
import {
  formatiereAggregat,
  formatiereBetrag,
  formatiereDatum,
  formatiereFlaeche,
  formatiereHonorarProzent,
} from '../format/de-ch.js';
import { berechneHonorarProzent } from '../model/honorar-eingabe.js';
import type { Offer } from '../model/offer.js';
import type { PreisZeile } from './dokument-schema.js';

export const TEXT_PLATZHALTER = [
  'adresse', 'ort', 'auftraggeber', 'anzahlEinheiten', 'anzahlWohnungstypen',
  'verkaufssumme', 'honorar', 'honorarBetrag', 'erstelltAm',
] as const;
export type TextPlatzhalterId = (typeof TEXT_PLATZHALTER)[number];

export interface PlatzhalterWerte {
  readonly texte: Readonly<Partial<Record<TextPlatzhalterId, string>>>;
  readonly preistabelle: readonly PreisZeile[];
}

// `preistabelle` ist im Katalog gelistet, aber KEIN Mitglied von
// `TEXT_PLATZHALTER` — sie ist der Block-Platzhalter (`platzhalterTabelle`), nicht ein
// Text-Platzhalter. Der Typ macht das sichtbar, statt beide unter einem `string` zu
// vermischen; die Unterscheidung nach Knotenart trifft `sammlePlatzhalterIds`
// (dokument-schema.ts) beim Speichern (vorlagen-ablage.ts).
export const PLATZHALTER_KATALOG:
  readonly { id: TextPlatzhalterId | 'preistabelle'; bezeichnung: string }[] = [
  { id: 'adresse', bezeichnung: 'Adresse der Liegenschaft' },
  { id: 'ort', bezeichnung: 'Ortschaft' },
  { id: 'auftraggeber', bezeichnung: 'Auftraggeber' },
  { id: 'anzahlEinheiten', bezeichnung: 'Anzahl Wohnungen' },
  { id: 'anzahlWohnungstypen', bezeichnung: 'Anzahl Wohnungstypen' },
  { id: 'verkaufssumme', bezeichnung: 'Verkaufssumme (berechnet)' },
  { id: 'honorar', bezeichnung: 'Honorar als Prozentsatz der Verkaufssumme (vom Vermarkter gewählt)' },
  { id: 'honorarBetrag', bezeichnung: 'Honorar als Frankenbetrag (vom Vermarkter gewählt)' },
  { id: 'erstelltAm', bezeichnung: 'Erstelldatum' },
  { id: 'preistabelle', bezeichnung: 'Preistabelle je Wohnung' },
];

export function platzhalterWerte(
  offer: Offer, kontext: { readonly auftraggeber?: string } = {},
): PlatzhalterWerte {
  const adresse = offer.property.adresse;
  return {
    texte: {
      adresse: `${adresse.strasse} ${adresse.hausnummer}, ${adresse.plz} ${adresse.ort}`,
      ort: adresse.ort,
      ...(kontext.auftraggeber === undefined ? {} : { auftraggeber: kontext.auftraggeber }),
      anzahlEinheiten: String(offer.derivation.units.length),
      anzahlWohnungstypen: String(offer.derivation.apartmentTypes.length),
      verkaufssumme: formatiereAggregat(offer.aggregates.totalSalesValue.value),
      // Fehlt (Offerte ohne gewaehlten Betrag, z. B. ein Altartefakt), bleiben beide
      // Schluessel weg — die Aufloesung meldet den fehlenden Platzhalter dann selbst
      // (aufloesung.ts, `PlatzhalterFehler`), statt hier die Honorarrange zu erfinden.
      // ZWEI Platzhalter statt einem: Ein gerundeter
      // Prozentsatz allein liesse sich vom Eigentuemer nicht verlustfrei auf den
      // massgebenden Betrag zurueckrechnen (3.14 % gerundet auf 3.1 % weicht bei
      // hohen Verkaufssummen um mehrere tausend Franken vom tatsaechlichen Honorar
      // ab) — `honorar` (Prozentsatz) und `honorarBetrag` (Franken) stehen deshalb
      // NEBENEINANDER im Dokument. Berechnung/Speicherung bleiben in Rappen
      // (`gewaehltesHonorar`); beide Platzhalter sind reine Anzeige desselben Werts.
      // `–` beim Prozentsatz, wenn die Verkaufssumme keine sinnvolle Bezugsgroesse ist
      // (`berechneHonorarProzent`) — der Frankenbetrag bleibt davon unberuehrt, er
      // haengt nicht von der Verkaufssumme ab.
      ...(offer.aggregates.gewaehltesHonorar === undefined ? {} : (() => {
        const betrag = offer.aggregates.gewaehltesHonorar.value;
        const anteil = berechneHonorarProzent(betrag, offer.aggregates.totalSalesValue.value);
        return {
          honorar: anteil === null ? '–' : formatiereHonorarProzent(anteil),
          honorarBetrag: formatiereAggregat(betrag),
        };
      })()),
      erstelltAm: formatiereDatum(offer.metadata.erstelltAm),
    },
    preistabelle: offer.derivation.units.map((u) => ({
      einheit: u.unitNumber,
      flaeche: formatiereFlaeche(u.weightedArea.value),
      preis: formatiereBetrag(u.unitPrice.value),
    })),
  };
}
