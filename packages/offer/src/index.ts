/**
 * Oeffentlicher Einstiegspunkt des Offert-Pakets (I-25).
 * Additiv gefuehrt: Bestehende Exporte werden nicht umbenannt oder entfernt (PE-15).
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

export { HerkunftsBlock, HerkunftsWert } from './template/HerkunftsWert.js';
export { OfferteDokument } from './template/OfferteDokument.js';
export { VermarktungsOfferte } from './template/VermarktungsOfferte.js';

// M-10: Kein weiterer Re-Export aus `vorlage/*` hier — zieht React/`.tsx` in den
// Graphen und darf aus Node-Kontexten deshalb nicht importiert werden (PE-09).

// `druckeOfferte` steht BEWUSST NICHT hier: Es zieht `playwright` in den
// Abhaengigkeitsgraphen; ueber den Paketindex landete es im Browser-Bundle der
// Erfassungsmaske und der Next-Build scheiterte. Import ausschliesslich ueber den
// Modulpfad: `import { druckeOfferte } from '@offert/offer/src/pdf/drucke-offerte.js';`
