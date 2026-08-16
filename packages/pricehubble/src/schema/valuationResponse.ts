/** Keine Formel. Contract-Schema der Bewertungsantwort E4 (Spec 04 §1.5). */
import { z } from 'zod';
import { ValuationSaleSchema } from './valuationSale.js';

export const ValuationResponseSchema = z.object({
  valuationSale: ValuationSaleSchema,
  isValuationStale: z.boolean(),
});

export type ValuationResponse = z.infer<typeof ValuationResponseSchema>;
