// I-25, PE-15, PE-20: Bewusst ohne .tsx/React, da auch aus dem jsx-freien Nachweislauf
// importiert. Vorlagenkomponenten stehen deshalb separat in @offert/offer/template.
export const PAKET_NAME = '@offert/offer';

export {
  HERKUNFT_BESCHRIFTUNG,
  herkunft,
  provenancedSchema,
} from './model/provenance.js';
export type { Herkunft, Provenanced } from './model/provenance.js';

export {
  adjustmentSchema,
  aggregateValuesSchema,
  apartmentTypeDerivationSchema,
  projectDataSchema,
  effortFactorTraceSchema,
  offerMetadataSchema,
  offerSchema,
  priceDerivationSchema,
  propertyDataSchema,
  tierTraceSchema,
  unitDerivationSchema,
} from './model/offer.js';
export type {
  Adjustment,
  AggregateValues,
  ProjectData,
  EffortFactorTrace,
  Offer,
  OfferMetadata,
  PriceDerivation,
  PropertyData,
  TierTrace,
} from './model/offer.js';

export { baueOfferte } from './model/baue-offerte.js';
export type { OfferteEingang } from './model/baue-offerte.js';

export {
  berechneHonorarProzent, honorarAbweichung, validiereGewaehltesHonorar,
} from './model/honorar-eingabe.js';
export type { HonorarAbweichung, HonorarPruefung } from './model/honorar-eingabe.js';

export {
  formatiereAggregat,
  formatiereBetrag,
  formatiereDatum,
  formatiereFlaeche,
  formatiereHonorarProzent,
  formatiereProzent,
  formatiereScore,
  formatiereZimmerzahl,
} from './format/de-ch.js';

export {
  offertDokumentSchema,
  sammlePlatzhalterIds,
  type OffertDokument,
} from './vorlage/dokument-schema.js';

export {
  standardVorlage,
  VORLAGE_VERSION,
} from './vorlage/standard-vorlage.js';

export {
  TEXT_PLATZHALTER,
  PLATZHALTER_KATALOG,
  platzhalterWerte,
} from './vorlage/platzhalter.js';

export {
  loeseDokumentAuf,
  PlatzhalterFehler,
} from './vorlage/aufloesung.js';

// druckeOfferte bewusst nicht hier (zieht playwright ins Browser-Bundle);
// import stattdessen aus '@offert/offer/druck'.
