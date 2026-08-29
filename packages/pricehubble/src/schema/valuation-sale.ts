/**
 * Keine Formel. Contract-Schema der Bewertungsantwort (Spec 04 §5.2, §5.3).
 * Tolerant nach oben (unbekannte Felder werden verworfen), streng nach unten.
 */
import { z } from 'zod';

/** Obergrenze des Plausibilitaetsfensters in CHF (Spec 04 §5.2). */
const PLAUSIBILITAETSGRENZE_CHF = 1e9;
/** Ein Tag Toleranz fuer Zeitzonenversatz beim Bewertungsdatum (Spec 04 §5.2). */
const DATUMS_TOLERANZ_MS = 86_400_000;

/**
 * Feldnamen des Dossier-Wegs (Bruno-Collection). Kapitel 2 nennt `salePrice`,
 * `salePriceRange`, `confidence` — das sind die Namen des zustandslosen Endpunkts
 * (R-04, Nachfuehrung N-4).
 */
export const ValuationSaleSchema = z
  .object({
    value: z.number().positive(),
    valueRange: z.object({ lower: z.number(), upper: z.number() }),
    valuationConfidence: z.enum(['poor', 'medium', 'good']),
    valuationConfidenceScore: z.number().min(0).max(1).optional(),
    valuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((wert, ctx) => {
    if (!(wert.valueRange.lower <= wert.value && wert.value <= wert.valueRange.upper)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valueRange'],
        message: 'valueRange.lower <= value <= valueRange.upper ist verletzt',
      });
    }
    if (wert.value >= PLAUSIBILITAETSGRENZE_CHF) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'value liegt ausserhalb des Plausibilitaetsfensters',
      });
    }
    if (Date.parse(wert.valuationDate) > Date.now() + DATUMS_TOLERANZ_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valuationDate'],
        message: 'valuationDate liegt in der Zukunft',
      });
    }
  });

export type ValuationSale = z.infer<typeof ValuationSaleSchema>;
