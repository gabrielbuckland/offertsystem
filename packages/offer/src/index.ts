/**
 * Oeffentlicher Einstiegspunkt des Offert-Pakets.
 * Ein Offert-Datenobjekt speist HTML-Darstellung und PDF-Export (I-25).
 *
 * Additiv gefuehrt: Bestehende Exporte werden nicht umbenannt oder entfernt, damit
 * abhaengige Aufrufstellen nicht bei jedem Schritt nachgezogen werden muessen (PE-15).
 */
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
  customerDataSchema,
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
  CustomerData,
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
  formatiereAggregat,
  formatiereBetrag,
  formatiereDatum,
  formatiereFlaeche,
  formatiereProzent,
  formatiereScore,
  formatiereZimmerzahl,
} from './format/de-ch.js';

export { HerkunftsBlock, HerkunftsWert } from './template/HerkunftsWert.js';
export { OfferteDokument } from './template/OfferteDokument.js';

export { druckeOfferte } from './pdf/drucke-offerte.js';
export type { BrowserFabrik, DruckOptionen } from './pdf/drucke-offerte.js';
