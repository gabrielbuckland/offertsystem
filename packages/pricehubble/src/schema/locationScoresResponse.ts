/** Keine Formel. Contract-Schema der Lagescore-Antwort E5 (Spec 04 §1.6). */
import { z } from 'zod';

/**
 * Neun Einzelscores (`subsec:ph_dimensionen`). Der Adapter polt `noise` und
 * `nuisance` NICHT um — die Umpolung geschieht ausschliesslich ueber vertauschte
 * Normalisierungsgrenzen in der Konfiguration (I-13, Spec 04 §4.2).
 *
 * UNVERIFIZIERT (G-2, OFFEN-2): Fuer E5 existiert keine aufgezeichnete Antwort.
 */
export const LAGESCORE_NAMEN = [
  'location',
  'family',
  'health',
  'leisure',
  'shopping',
  'catering',
  'view',
  'noise',
  'nuisance',
] as const;

const EinzelscoreSchema = z.object({
  score: z.number().min(0).max(1),
  originalScore: z.number().min(0).max(1).optional(),
  isOverridden: z.boolean().optional(),
});

export const LocationScoresResponseSchema = z.object(
  Object.fromEntries(LAGESCORE_NAMEN.map((name) => [name, EinzelscoreSchema])) as Record<
    (typeof LAGESCORE_NAMEN)[number],
    typeof EinzelscoreSchema
  >,
);

export type LocationScoresResponse = z.infer<typeof LocationScoresResponseSchema>;
