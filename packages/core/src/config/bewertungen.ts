// Keine Formel. Feldmenge/Enums der PriceHubble-Objekte `condition`/`quality`
// (docs.pricehubble.com, dossier_creation/valuation) — Fremdformat zur Zurueckweisung.
import { z } from 'zod';

export const BEWERTUNGSFELDER = ['bathrooms', 'kitchen', 'flooring', 'windows'] as const;

export const ZUSTANDSWERTE = [
  'renovation_needed', 'well_maintained', 'new_or_recently_renovated',
] as const;

export const QUALITAETSWERTE = ['simple', 'normal', 'high_quality', 'luxury'] as const;

export const ZustandsbewertungenSchema = z.object({
  bathrooms: z.enum(ZUSTANDSWERTE),
  kitchen: z.enum(ZUSTANDSWERTE),
  flooring: z.enum(ZUSTANDSWERTE),
  windows: z.enum(ZUSTANDSWERTE),
}).strict();

export const QualitaetsbewertungenSchema = z.object({
  bathrooms: z.enum(QUALITAETSWERTE),
  kitchen: z.enum(QUALITAETSWERTE),
  flooring: z.enum(QUALITAETSWERTE),
  windows: z.enum(QUALITAETSWERTE),
}).strict();

// Serverseitig geschlossen (live belegt 2026-09-01, sonst 400). Leerer String = "nicht
// angegeben", wird beim PATCH weggelassen; die API kennt keinen Leerwert.
export const ENERGIELABELWERTE = [
  '', 'minergie', 'minergie_p', 'minergie_a', 'minergie_eco', 'minergie_p_eco',
  'minergie_a_eco',
] as const;

export const HEIZUNGSARTWERTE = [
  '', 'electric', 'wood', 'gas', 'oil', 'district', 'heat_pump_air',
  'heat_pump_geothermal', 'solar',
] as const;

export const BADEZIMMER_MIN = 1;
export const BADEZIMMER_MAX = 5;

export const EnergielabelSchema = z.enum(ENERGIELABELWERTE);
export const HeizungsartSchema = z.enum(HEIZUNGSARTWERTE);

export type Energielabel = typeof ENERGIELABELWERTE[number];
export type Heizungsart = typeof HEIZUNGSARTWERTE[number];

export type Bewertungsfeld = typeof BEWERTUNGSFELDER[number];
export type Zustandswert = typeof ZUSTANDSWERTE[number];
export type Qualitaetswert = typeof QUALITAETSWERTE[number];
export type Zustandsbewertungen = z.infer<typeof ZustandsbewertungenSchema>;
export type Qualitaetsbewertungen = z.infer<typeof QualitaetsbewertungenSchema>;
