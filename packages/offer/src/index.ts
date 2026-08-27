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
export { VermarktungsOfferte } from './template/VermarktungsOfferte.js';

// M-10: Kein weiterer Re-Export aus `vorlage/*` hier. Der Index zieht laut Kommentar
// unten (`druckeOfferte`) React/`.tsx` in den Graphen und darf aus Node-Kontexten
// gerade DESHALB nicht importiert werden (PE-09); ein Grep über apps/tools/packages
// zeigt, dass alle Aufrufer der Vorlagen-/Platzhalter-/Auflösungsfunktionen ohnehin
// ueber die Modulpfade importieren (Global Constraint), nie ueber diesen Index.

/*
 * `druckeOfferte` steht BEWUSST NICHT hier, abweichend vom Plan. Der Drucker zieht
 * `playwright` in den Abhaengigkeitsgraphen; ueber den Paketindex landete es im
 * Browser-Bundle der Erfassungsmaske, und der Next-Build scheiterte. Der Druckpfad wird
 * ausschliesslich serverseitig gebraucht und deshalb ueber seinen Modulpfad eingebunden:
 *   import { druckeOfferte } from '@offert/offer/src/pdf/drucke-offerte.js';
 * Das bleibt ein Paketimport ueber `@offert/*` und verletzt die Boundary-Regel nicht.
 */
