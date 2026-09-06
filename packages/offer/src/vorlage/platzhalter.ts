// Keine Formel. Platzhalterkatalog der Offerttexte — die eine Stelle, an der
// Berechnungsergebnis und Vorlagentext zusammenkommen. auftraggeber stammt bewusst
// nicht aus dem Offert-Objekt (kein Empfänger im Schema), sondern aus dem Projektfeld;
// fehlt er, meldet die Auflösung den Fehler beim Finalisieren (fail fast).
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

// preistabelle ist im Katalog gelistet, aber kein Mitglied von TEXT_PLATZHALTER — sie
// ist der Block-Platzhalter (platzhalterTabelle), kein Text-Platzhalter.
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
      // Fehlt gewaehltesHonorar (Altartefakt), bleiben beide Schluessel weg — die
      // Aufloesung meldet den fehlenden Platzhalter selbst (PlatzhalterFehler).
      // Zwei Platzhalter statt einem: ein gerundeter Prozentsatz allein liesse sich
      // nicht verlustfrei auf den massgebenden Betrag zurueckrechnen, deshalb stehen
      // honorar (Prozentsatz) und honorarBetrag (Franken) nebeneinander.
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
