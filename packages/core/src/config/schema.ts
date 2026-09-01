/**
 * Keine Formel. Ebene 1 der Konfigurationspruefung: Struktur (Spec 02 §3.1).
 * Die geprueften Parameter gehen in eq:flaeche, eq:normalisierung,
 * eq:aufwandindikator und eq:honorar_mapping ein; gerechnet wird hier nicht.
 * Geprueft werden Pflichtfelder, JSON-Typen, unbekannte Schluessel, Aufzaehlungen
 * und die Schemaversion. Zahlenbereiche gehoeren bewusst nach Ebene 2, damit
 * jede Verletzung einen fachlich sprechenden CFG_*-Code traegt.
 */
import { z } from 'zod';
import { QualitaetsbewertungenSchema, ZustandsbewertungenSchema } from './bewertungen.js';
import {
  ROH_SCHREIBWEISE,
  STRATEGIE_BEZEICHNER,
  type RohStrategieBezeichner,
} from '../normalization/bezeichner.js';

/** Die neun von PriceHubble dokumentierten Lagescores (I-26: keine Verdichtung). */
export const LAGESCORE_NAMEN = [
  'location', 'family', 'health', 'leisure', 'shopping',
  'catering', 'view', 'noise', 'nuisance',
] as const;

/**
 * Im Kern vorhandene Ableitungen fuer Faktoren der Quelle "abgeleitet" (E-05).
 * ACHTUNG: Das sind QUELLSCHLUESSEL, keine Faktorschluessel. Der Faktor, der die
 * Einheitenzahl verarbeitet, heisst weiterhin `projektumfang`; sein
 * quellSchluessel ist `einheitenzahl` (PE-03).
 */
export const ABLEITUNGS_NAMEN = ['einheitenzahl', 'mittlererQuadratmeterpreis'] as const;

export const BEZEICHNER_MUSTER = /^[a-z][a-zA-Z0-9_]*$/;

export type FaktorQuelle = 'lagescore' | 'manuell' | 'abgeleitet';
/**
 * Schreibweise des JSON-Schemas. Der Kern fuehrt die Bezeichner aus
 * `normalization/bezeichner.ts`; uebersetzt wird genau einmal, in parseKonfiguration
 * (PE-02, PE-01). Die zulaessigen Werte sind aus derselben Liste ABGELEITET, nicht
 * dupliziert — eine neue Strategie braucht keine Schemaaenderung (E-15).
 */
export type StrategieBezeichner = RohStrategieBezeichner;

/** Nicht leer, weil die Bezeichner-Liste per Konstruktion mindestens min-max fuehrt. */
const ROH_STRATEGIEN = STRATEGIE_BEZEICHNER.map((b) => ROH_SCHREIBWEISE[b]) as
  [RohStrategieBezeichner, ...RohStrategieBezeichner[]];

const MetaSchema = z.object({
  schemaVersion: z.literal(1),
  konfigVersion: z.string().min(1),
  gueltigAb: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  beschreibung: z.string(),
}).strict();

const FlaecheSchema = z.object({ alpha: z.number() }).strict();

const PreisanpassungSchema = z.object({
  zMin: z.number(),
  zMax: z.number(),
  begruendungPflicht: z.literal(true),
  begruendungMinLaenge: z.number(),
}).strict();

const BereichSchema = z.object({
  unter: z.number().optional(),
  wert: z.number(),
}).strict();

const BereichsregelSchema = z.object({
  merkmal: z.string().regex(BEZEICHNER_MUSTER),
  bereiche: z.array(BereichSchema),
}).strict();

const MerkmalSchema = z.object({
  id: z.string().regex(BEZEICHNER_MUSTER),
  bezeichnung: z.string().min(1),
  form: z.literal('zahl'),
}).strict();

const AnpassungsVorlageSchema = z.object({
  id: z.string().regex(BEZEICHNER_MUSTER),
  bezeichnung: z.string().min(1),
  vorgabefaktor: z.number(),
  // Vorgabe 'relativ' haelt bestehende Konfigurationsdateien gueltig.
  erfassungsform: z.enum(['relativ', 'absolut']).default('relativ'),
  begruendungVorschlag: z.string(),
  regel: BereichsregelSchema.optional(),
}).strict();

const ReferenzverteilungSchema = z.object({
  mittelwert: z.number(),
  standardabweichung: z.number(),
  kappungSigma: z.number(),
}).strict();

/**
 * Rein deskriptive Beschreibung einer ordinalen Erfassungsskala (PE-05, E-24),
 * geht in keine Formel ein. Zweck: die Oberflaeche liest die Stufenbeschriftungen
 * aus der Konfiguration statt sie zu kodieren.
 */
const SkalaSchema = z.object({
  form: z.literal('ordinal'),
  stufen: z.array(z.object({
    wert: z.number(),
    bezeichnung: z.string().min(1),
  }).strict()),
}).strict();

const FaktorSchema = z.object({
  bezeichnung: z.string().min(1),
  quelle: z.enum(['lagescore', 'manuell', 'abgeleitet']),
  quellSchluessel: z.string().min(1),
  strategie: z.enum(ROH_STRATEGIEN),
  min: z.number(),
  max: z.number(),
  gewicht: z.number(),
  referenzverteilung: ReferenzverteilungSchema.optional(),
  skala: SkalaSchema.optional(),
}).strict();

const StuetzstelleSchema = z.object({
  v: z.number(),
  hMin: z.number(),
  hMax: z.number(),
}).strict();

const SkalierungSchema = z.object({
  form: z.literal('linear'),
  gMin: z.number(),
  gMax: z.number(),
}).strict();

const HonorarSchema = z.object({
  stuetzstellen: z.array(StuetzstelleSchema),
  skalierung: SkalierungSchema,
}).strict();

export const DossierDefaultsSchema = z.object({
  zustandsbewertungen: ZustandsbewertungenSchema,
  qualitaetsbewertungen: QualitaetsbewertungenSchema,
}).strict();

const ApiSchema = z.object({
  baseUrl: z.string().min(1),
  endpunkte: z.object({
    login: z.string().min(1),
    dossierGet: z.string().min(1),
    dossierUpdate: z.string().min(1),
    dossierValuation: z.string().min(1),
    locationScores: z.string().min(1),
  }).strict(),
  timeoutMs: z.number(),
  timeoutValuationMs: z.number(),
  gesamtbudgetMs: z.number(),
  retry: z.object({
    maxVersuche: z.number(),
    startBackoffMs: z.number(),
    backoffFaktor: z.number(),
    maxBackoffMs: z.number(),
    jitter: z.enum(['voll', 'keiner']),
    retryAfterBeachten: z.boolean(),
    retryAfterMaxSekunden: z.number(),
    retryStatuscodes: z.array(z.number()),
  }).strict(),
  tokenGueltigkeitMin: z.number(),
  /** Vorlaufzeit, um die ein Token vor Ablauf erneuert wird (PE-06). Standard: 30 Minuten. */
  tokenSicherheitsmargeMin: z.number(),
}).strict();

export const RohKonfigurationSchema = z.object({
  meta: MetaSchema,
  flaeche: FlaecheSchema,
  preisanpassung: PreisanpassungSchema,
  anpassungsVorlagen: z.array(AnpassungsVorlageSchema),
  merkmale: z.array(MerkmalSchema).default([]),
  // Abbildung Faktorbezeichner -> Parameter, KEINE Aufzaehlung (Brief §5.4, I-13).
  aufwandfaktoren: z.record(z.string().regex(BEZEICHNER_MUSTER), FaktorSchema),
  honorar: HonorarSchema,
  dossierDefaults: DossierDefaultsSchema,
  api: ApiSchema,
}).strict();

export type RohKonfiguration = z.infer<typeof RohKonfigurationSchema>;
export type RohFaktor = RohKonfiguration['aufwandfaktoren'][string];
export type RohStuetzstelle = RohKonfiguration['honorar']['stuetzstellen'][number];
export type DossierDefaults = RohKonfiguration['dossierDefaults'];
export type AnpassungsVorlage = RohKonfiguration['anpassungsVorlagen'][number];
export type Skala = NonNullable<RohFaktor['skala']>;
export type RohApiKonfiguration = RohKonfiguration['api'];
