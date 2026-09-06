/** Keine Formel. Contract-Schema der Bewertungsantwort E4. */
import { z } from 'zod';
import { ValuationSaleSchema } from './valuation-sale.js';

export const ValuationResponseSchema = z.object({
  valuationSale: ValuationSaleSchema,
  isValuationStale: z.boolean(),
});

export type ValuationResponse = z.infer<typeof ValuationResponseSchema>;
