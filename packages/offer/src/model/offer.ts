/**
 * Keine Formel. Datenvertrag der Offerte in fuenf Bereichen (Spec 05 §1.2).
 * Gerechnet wird hier nicht; das Schema haelt fest, WELCHE Groessen in welcher
 * Rundungsstufe erscheinen duerfen.
 *
 * Rundungsordnung (E-09), im Typ verankert statt im Kommentar:
 *   R1 — `referenceValuation.marktwert` (Uebernahme des Referenzwerts), ganzzahlig
 *   R2 — `unitPrice` (Wohnungspreis je Einheit), ganzzahlig
 *   R3 — `feeRange.min/max` (Honorarrange nach g(D)), ganzzahlig
 * Ungerundet bleiben `pricePerSqm`, `basePrice`, `feeBasis.min/max` — sie sind
 * Zwischengroessen, und ein vierter Rundungspunkt entstuende sonst durch die
 * Hintertuer der Serialisierung.
 *
 * Keine Faktorbezeichner: Die Faktorliste ist datengetrieben (I-13). Ein Schema, das
 * einen einzelnen Aufwandfaktor als eigenes Feld fuehrte, machte die
 * Null-Dateien-Messlatte aus 6.3 unhaltbar — ein neuer Faktor aendert die
 * Konfiguration, nicht diese Datei.
 */
import { z } from 'zod';
import { provenancedSchema } from './provenance.js';

const rappen = z.number().int().finite();              // ganzzahlig: R1, R2, R3
const rappenGenau = z.number().finite();               // ungerundeter Zwischenwert
const quadratmeter = z.number().finite().positive();

/**
 * Erster Bereich der Offerte. Fuehrt die Kennung des erzeugenden Projekts (Spec 05 §8),
 * keine Referenznummer: Ein Projekt kann mehrere Offerten hervorbringen, `projektId` ist
 * also keine Dublette von `offertId`, sondern haelt die Herkunft nachvollziehbar. Ein
 * Projekt identifiziert sich gegenueber Menschen ueber Adresse und Datum (Spec 05 §2) —
 * beides steht bereits in `property` bzw. `metadata.erstelltAm`. Kundenname und
 * Kontaktangaben sind bewusst nicht Bestandteil des Prototyps -- er berechnet den
 * Kalkulationsteil und adressiert keinen Empfaenger.
 */
export const projectDataSchema = z.object({
  projektId: z.string().uuid(),
}).strict();

export const propertyDataSchema = z.object({
  adresse: z.object({
    strasse: z.string().min(1),
    hausnummer: z.string().min(1),
    plz: z.string().regex(/^\d{4}$/),                  // Schweizer Format, NFA-13
    ort: z.string().min(1),
  }).strict(),
  // I-26: einzeln gefuehrt, keine Verdichtung zu einem Sammelwert
  lagescores: z.array(
    provenancedSchema(
      z.object({ name: z.string().min(1), score: z.number().min(0).max(1) }).strict(),
      'pricehubble',
    ),
  ).min(1),
}).strict();

export const adjustmentSchema = z.object({
  factor: z.number().finite(),
  enteredAs: z.enum(['factor', 'amount']),
  enteredAmount: rappen.optional(),
  justification: z.string().min(1),                    // Pflichtfeld, US-04, I-09
  vorlageId: z.string().min(1).optional(),             // dokumentarisch, Spec 02 §3.4.1
}).strict().refine(
  (a) => (a.enteredAs === 'amount') === (a.enteredAmount !== undefined),
  { message: 'enteredAmount ist genau dann gesetzt, wenn enteredAs = amount' },
);

export const apartmentTypeDerivationSchema = z.object({
  typeId: z.string().min(1),
  roomCount: z.number().min(1).max(12),
  dossierParameters: z.object({
    flaecheInnen: quadratmeter,
    flaecheAussen: z.number().finite().nonnegative(),
    stockwerk: z.number().int(),
    energielabel: z.string(),
    zustandsbewertungen: z.record(z.string()),
    qualitaetsbewertungen: z.record(z.string()),
    anzahlBadezimmer: z.number().int().nonnegative(),
    lift: z.boolean(),
    baujahr: z.number().int(),
    heizungsart: z.string(),
  }).strict(),
  referenceValuation: provenancedSchema(
    z.object({
      marktwert: rappen,                               // R1, unveraendert uebernommen
      bewertungsdatum: z.string().min(1),
      anbieter: z.string().min(1),
      konfidenzbereich: z.object({ von: rappen, bis: rappen }).strict(),
      konfidenzklasse: z.enum(['poor', 'medium', 'good']),
      konfidenzwert: z.number().optional(),
    }).strict(),
    'pricehubble',
  ),
  referenceArea: provenancedSchema(quadratmeter, 'local-derivation'),
  pricePerSqm: provenancedSchema(rappenGenau, 'local-derivation'),  // UNGERUNDET
}).strict();

export const unitDerivationSchema = z.object({
  unitNumber: z.string().min(1),
  typeId: z.string().min(1),
  areaInner: quadratmeter,
  areaOuter: z.number().finite().nonnegative(),
  floor: z.number().int(),
  weightedArea: provenancedSchema(quadratmeter, 'local-derivation'),
  basePrice: provenancedSchema(rappenGenau, 'local-derivation'),    // UNGERUNDET
  adjustments: z.array(provenancedSchema(adjustmentSchema, 'marketer-adjustment')),
  adjustmentSum: provenancedSchema(z.number().gt(-1), 'marketer-adjustment'),  // I-06
  unitPrice: provenancedSchema(rappen, 'local-derivation'),         // R2
}).strict();

export const priceDerivationSchema = z.object({
  alpha: z.number().min(0).max(1),                     // I-04
  apartmentTypes: z.array(apartmentTypeDerivationSchema).min(1),
  units: z.array(unitDerivationSchema).min(1),
}).strict();

export const effortFactorTraceSchema = z.object({
  id: z.string().min(1),
  bezeichnung: z.string().min(1),
  quelle: z.enum(['lagescore', 'manuell', 'abgeleitet']),
  rawValue: z.number().finite(),
  grenzeMin: z.number().finite(),
  grenzeMax: z.number().finite(),
  strategie: z.string().min(1),
  gekappt: z.boolean(),
  normalised: z.number().min(0).max(1),                // I-10
  weight: z.number().min(0).max(1),
  beitrag: z.number().finite(),                        // w_d * x̂_d
}).strict();

export const tierTraceSchema = z.object({
  k: z.number().int().nonnegative(),
  vMin: rappen, vMax: rappen,
  hMinK: rappen, hMinK1: rappen, hMaxK: rappen, hMaxK1: rappen,
  interpolationsAnteil: z.number().min(0).lt(1),
}).strict();

export const aggregateValuesSchema = z.object({
  totalSalesValue: provenancedSchema(rappen, 'local-derivation'),
  einheitenzahl: z.number().int().positive(),          // m, geht als Faktor in D ein
  effortFactors: z.array(effortFactorTraceSchema).min(1),
  gewichtssumme: z.number().finite(),                  // Sigma w_d, ausgewiesen (I-12)
  effortIndicator: provenancedSchema(z.number().min(0).max(1), 'local-calculation'),
  feeTier: provenancedSchema(tierTraceSchema, 'local-calculation'),
  scalingFactor: provenancedSchema(z.number().positive(), 'local-calculation'),
  feeBasis: provenancedSchema(
    z.object({ min: rappenGenau, max: rappenGenau }).strict(),      // UNGERUNDET
    'local-calculation',
  ),
  feeRange: provenancedSchema(
    z.object({ min: rappen, max: rappen }).strict(),                // R3
    'local-calculation',
  ),
}).strict();

export const offerMetadataSchema = z.object({
  offertId: z.string().min(1),
  projektId: z.string().uuid(),
  erstelltAm: z.string().min(1),                       // ISO-8601, aus apps/web (E-29)
  bewertungsversion: z.array(z.object({
    typeId: z.string().min(1),
    bewertungsdatum: z.string().min(1),
    konfidenzklasse: z.enum(['poor', 'medium', 'good']),
  }).strict()).min(1),
  /**
   * Eingebettete **Kopie** der Konfiguration, kein Verweis — sonst verfehlt US-10/US-13
   * beim naechsten Konfigwechsel. Der Name bezeichnet projektweit die Kopie; der
   * Kurzausweis heisst bei P1 `KonfigurationsFingerabdruck` (PE-04).
   */
  konfigurationsAbdruck: z.record(z.unknown()),
  konfigVersion: z.string().min(1),
  /** SHA-256 der kanonisch serialisierten Konfiguration, eigenes Feld (E-26, PE-04). */
  konfigPruefsumme: z.string().regex(/^[0-9a-f]{64}$/),
  /**
   * Ergebnis von `serialisiereEingang(EingangsArgumente)` aus @offert/core (PE-08) —
   * nicht die Formulardaten. Bezugsquelle des Reproduktionstests (Spec 06 §9);
   * `deserialisiereEingang` fuehrt sie ohne Umweg ueber die Erfassung zurueck.
   */
  berechnungsEingabe: z.record(z.unknown()),
}).strict();

export const offerSchema = z.object({
  project: projectDataSchema,
  property: propertyDataSchema,
  derivation: priceDerivationSchema,
  aggregates: aggregateValuesSchema,
  metadata: offerMetadataSchema,
}).strict();

export type Offer = z.infer<typeof offerSchema>;
export type ProjectData = z.infer<typeof projectDataSchema>;
export type PropertyData = z.infer<typeof propertyDataSchema>;
export type PriceDerivation = z.infer<typeof priceDerivationSchema>;
export type AggregateValues = z.infer<typeof aggregateValuesSchema>;
export type OfferMetadata = z.infer<typeof offerMetadataSchema>;
export type Adjustment = z.infer<typeof adjustmentSchema>;
export type TierTrace = z.infer<typeof tierTraceSchema>;
export type EffortFactorTrace = z.infer<typeof effortFactorTraceSchema>;
