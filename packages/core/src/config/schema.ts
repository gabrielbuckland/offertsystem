/**
 * Ebene 1 der Konfigurationspruefung: Struktur (Spec 02 §3.1).
 * Geprueft werden Pflichtfelder, JSON-Typen, unbekannte Schluessel, Aufzaehlungen
 * und die Schemaversion. Zahlenbereiche gehoeren bewusst nach Ebene 2, damit
 * jede Verletzung einen fachlich sprechenden CFG_*-Code traegt.
 */
import { z } from 'zod';

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
 * Schreibweise des JSON-Schemas. Der Kern fuehrt die Union 'min-max' | 'z-score';
 * uebersetzt wird genau einmal, in parseKonfiguration (PE-02, PE-01).
 */
export type StrategieBezeichner = 'minmax' | 'zscore';

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

const AnpassungsVorlageSchema = z.object({
  id: z.string().regex(BEZEICHNER_MUSTER),
  bezeichnung: z.string().min(1),
  vorgabefaktor: z.number(),
  begruendungVorschlag: z.string(),
}).strict();

const ReferenzverteilungSchema = z.object({
  mittelwert: z.number(),
  standardabweichung: z.number(),
  kappungSigma: z.number(),
}).strict();

/**
 * Rein deskriptive Beschreibung einer ordinalen Erfassungsskala (PE-05, E-24).
 * Sie geht in KEINE Formel ein — dieselbe Stellung wie `bezeichnung`. Ihr Zweck
 * ist die datengetriebene Faktorerfassung: Die Oberflaeche liest die
 * Stufenbeschriftungen aus der Konfiguration, statt sie zu kodieren.
 *
 * Ohne dieses Feld wiese das .strict()-Schema eine Konfiguration mit `skala`
 * zurueck, und die Beschriftungen waeren nur ueber Codeaenderungen erreichbar.
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
  strategie: z.enum(['minmax', 'zscore']),
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

const DossierDefaultsSchema = z.object({
  flaecheInnen: z.number().nullable(),
  flaecheAussen: z.number().nullable(),
  stockwerk: z.number().nullable(),
  energielabel: z.string().nullable(),
  zustandsbewertungen: z.record(z.string()),
  qualitaetsbewertungen: z.record(z.string()),
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
  /**
   * Vorlaufzeit, um die ein Token vor Ablauf erneuert wird (PE-06). P3 liest das
   * Feld; ohne es im .strict()-Schema wuerde eine Konfiguration, die es fuehrt,
   * zurueckgewiesen. Vorgabewert der Standardkonfiguration: 30 Minuten.
   */
  tokenSicherheitsmargeMin: z.number(),
}).strict();

export const RohKonfigurationSchema = z.object({
  meta: MetaSchema,
  flaeche: FlaecheSchema,
  preisanpassung: PreisanpassungSchema,
  anpassungsVorlagen: z.array(AnpassungsVorlageSchema),
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
