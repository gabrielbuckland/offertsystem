/**
 * Keine Formel. Datenvertrag der Offerte in fuenf Bereichen.
 *
 * Rundungsordnung (E-09): R1 `referenceValuation.marktwert`, R2 `unitPrice`,
 * R3 `feeRange.min/max` und `gewaehltesHonorar` sind ganzzahlig. `pricePerSqm`, `basePrice`,
 * `feeBasis.min/max` bleiben ungerundet (Zwischengroessen).
 *
 * Keine Faktorbezeichner: Die Faktorliste ist datengetrieben (I-13) — ein neuer
 * Aufwandfaktor aendert die Konfiguration, nicht dieses Schema.
 */
import {
  BADEZIMMER_MAX, BADEZIMMER_MIN, EnergielabelSchema, HeizungsartSchema,
} from '@offert/core';
import { z } from 'zod';
import { provenancedSchema } from './provenance.js';
import { aufgeloestesDokumentSchema } from '../vorlage/dokument-schema.js';

const rappen = z.number().int().finite();              // ganzzahlig: R1, R2, R3
const rappenGenau = z.number().finite();               // ungerundeter Zwischenwert
const quadratmeter = z.number().finite().positive();

/**
 * Erster Bereich der Offerte: Kennung des erzeugenden Projekts.
 * `projektId` ist keine Dublette von `offertId` — ein Projekt kann mehrere Offerten
 * hervorbringen. Kundenname/Kontakt bewusst nicht Teil des Prototyps: Er berechnet
 * den Kalkulationsteil und adressiert keinen Empfaenger.
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
  vorlageId: z.string().min(1).optional(),             // rein dokumentarisch
  /** Nachweis der Regel, aus der der Wert stammt; rein dokumentarisch, erscheint
   *  bewusst NICHT im gerenderten Dokument (geht an den Eigentuemer, nicht an den
   *  Vermarkter). */
  regel: z.object({
    merkmal: z.string().min(1),
    merkmalswert: z.number(),
    bereich: z.number().int().nonnegative(),
    regelwert: z.number(),
  }).strict().optional(),
  uebersteuert: z.literal(true).optional(),
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
    energielabel: EnergielabelSchema,
    zustandsbewertungen: z.record(z.string()),
    qualitaetsbewertungen: z.record(z.string()),
    anzahlBadezimmer: z.number().int().min(BADEZIMMER_MIN).max(BADEZIMMER_MAX),
    lift: z.boolean(),
    baujahr: z.number().int(),
    heizungsart: HeizungsartSchema,
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
  /**
   * Der EINE Honorarbetrag, den die Offerte dem Eigentuemer nennt.
   * `feeRange` bleibt daneben bestehen — sie ist die interne Empfehlung, keine dem
   * Eigentuemer zu zeigende Zahl. Herkunft `marketer-decision`, nicht
   * `local-calculation`: Der Betrag ist eine Eingabe des Vermarkters, keine Ableitung.
   * Optional, weil `baueOfferte` (E-19/E-20) ihn nicht kennt — er entsteht erst mit der
   * Bestaetigung im Eingabemodal und wird von der Offert-Route ergaenzt, analog `dokument`.
   */
  gewaehltesHonorar: provenancedSchema(rappen, 'marketer-decision').optional(),  // R3
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
  /** Eingebettete Kopie der Konfiguration, kein Verweis — sonst verfehlt US-10/US-13
   *  beim naechsten Konfigwechsel. Kurzausweis heisst bei P1 `KonfigurationsFingerabdruck` (PE-04). */
  konfigurationsAbdruck: z.record(z.unknown()),
  konfigVersion: z.string().min(1),
  /** SHA-256 der kanonisch serialisierten Konfiguration, eigenes Feld (E-26, PE-04). */
  konfigPruefsumme: z.string().regex(/^[0-9a-f]{64}$/),
  /** Ergebnis von `serialisiereEingang(EingangsArgumente)` aus @offert/core (PE-08),
   *  nicht die Formulardaten. Basis des Reproduktionstests; `deserialisiereEingang`
   *  fuehrt sie zurueck. */
  berechnungsEingabe: z.record(z.unknown()),
}).strict();

/**
 * Kundengerichteter Offerttext: Ergebnis der Platzhalter-Aufloesung,
 * NIE die Vorlage — selbsttragend, unabhaengig vom Vorlagenstand (US-13). Optional, damit
 * Altartefakte gueltig bleiben (I-24). `auftraggeber` steht hier statt im Offert-Kern,
 * da Empfaengerangabe des Dokuments, keine Rechengroesse.
 */
export const offertDokumentBlockSchema = z.object({
  inhalt: aufgeloestesDokumentSchema,
  vorlageVersion: z.string().min(1),
  auftraggeber: z.string().min(1).optional(),
}).strict();

export const offerSchema = z.object({
  project: projectDataSchema,
  property: propertyDataSchema,
  derivation: priceDerivationSchema,
  aggregates: aggregateValuesSchema,
  metadata: offerMetadataSchema,
  dokument: offertDokumentBlockSchema.optional(),
}).strict();

export type Offer = z.infer<typeof offerSchema>;
export type ProjectData = z.infer<typeof projectDataSchema>;
export type PropertyData = z.infer<typeof propertyDataSchema>;
export type PriceDerivation = z.infer<typeof priceDerivationSchema>;
export type AggregateValues = z.infer<typeof aggregateValuesSchema>;
export type OfferMetadata = z.infer<typeof offerMetadataSchema>;
export type OffertDokumentBlock = z.infer<typeof offertDokumentBlockSchema>;
export type Adjustment = z.infer<typeof adjustmentSchema>;
export type TierTrace = z.infer<typeof tierTraceSchema>;
export type EffortFactorTrace = z.infer<typeof effortFactorTraceSchema>;
