/**
 * Oeffentlicher Einstiegspunkt des Offert-Pakets (I-25).
 * Additiv gefuehrt: Bestehende Exporte werden nicht umbenannt oder entfernt (PE-15).
 *
 * Bewusst OHNE `.tsx`/React: Dieser Index wird auch aus reinen Server-/Logikdateien
 * importiert, die ueber tools/-Werkzeuge im jsx-freien Nachweislauf
 * (`tsc -p tools/tsconfig.json`, PE-20) landen. Die HTML-Vorlagenkomponenten stehen
 * deshalb im eigenen Einstiegspunkt `@offert/offer/template` (Paketgrenzen-Bereinigung).
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

// M-10 galt nur, solange kein Aufrufer ueber den Index importierte (Global Constraint);
// apps/web importiert diese Symbole inzwischen ausschliesslich ueber den Paketindex statt
// ueber Modulpfade (Paketgrenzen-Bereinigung), daher jetzt regulaer re-exportiert.
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

// `druckeOfferte` steht BEWUSST NICHT hier: Es zieht `playwright` in den
// Abhaengigkeitsgraphen; ueber den Paketindex landete es im Browser-Bundle der
// Erfassungsmaske und der Next-Build scheiterte. Import ausschliesslich ueber den
// eigenen Einstiegspunkt: `import { druckeOfferte } from '@offert/offer/druck';`
