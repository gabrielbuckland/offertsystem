/** Keine Formel. Contract-Schema der Lagescore-Antwort E5. */
import { z } from 'zod';

/**
 * Neun Einzelscores (`subsec:ph_dimensionen`). Keine Umpolung von `noise`/`nuisance`
 * hier — geschieht ueber vertauschte Normalisierungsgrenzen in der Konfiguration (I-13).
 * Dieselben Namen erscheinen zusaetzlich flach auf oberster Ebene als blosse Zahlen;
 * sie werden verworfen, weil ihnen `originalScore`/`isOverridden` fehlen. Gegen eine
 * echte Antwort verifiziert.
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

export const LocationScoresResponseSchema = z.object({
  scores: z.object(
    Object.fromEntries(LAGESCORE_NAMEN.map((name) => [name, EinzelscoreSchema])) as Record<
      (typeof LAGESCORE_NAMEN)[number],
      typeof EinzelscoreSchema
    >,
  ),
});

export type LocationScoresResponse = z.infer<typeof LocationScoresResponseSchema>;
