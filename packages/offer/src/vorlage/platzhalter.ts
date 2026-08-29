/**
 * Keine Formel. Platzhalterkatalog der Offerttexte (Spec 2026-08-27 §2).
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
} from '../format/de-ch.js';
import type { Offer } from '../model/offer.js';
import type { PreisZeile } from './dokument-schema.js';

export const TEXT_PLATZHALTER = [
  'adresse', 'ort', 'auftraggeber', 'anzahlEinheiten', 'anzahlWohnungstypen',
  'verkaufssumme', 'honorarMin', 'honorarMax', 'erstelltAm',
] as const;
export type TextPlatzhalterId = (typeof TEXT_PLATZHALTER)[number];

export interface PlatzhalterWerte {
  readonly texte: Readonly<Partial<Record<TextPlatzhalterId, string>>>;
  readonly preistabelle: readonly PreisZeile[];
}

// M-1: `preistabelle` ist im Katalog gelistet, aber KEIN Mitglied von
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
  { id: 'honorarMin', bezeichnung: 'Honorar untere Grenze (berechnet)' },
  { id: 'honorarMax', bezeichnung: 'Honorar obere Grenze (berechnet)' },
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
      honorarMin: formatiereAggregat(offer.aggregates.feeRange.value.min),
      honorarMax: formatiereAggregat(offer.aggregates.feeRange.value.max),
      erstelltAm: formatiereDatum(offer.metadata.erstelltAm),
    },
    preistabelle: offer.derivation.units.map((u) => ({
      einheit: u.unitNumber,
      flaeche: formatiereFlaeche(u.weightedArea.value),
      preis: formatiereBetrag(u.unitPrice.value),
    })),
  };
}
