/** Keine Formel. Contract-Schema der Dossier-Antwort (Spec 04 §1.3). */
import { z } from 'zod';
import { ValuationSaleSchema } from './valuationSale.js';

export const AdresseSchema = z.object({
  street: z.string(),
  houseNumber: z.string(),
  postCode: z.string(),
  city: z.string(),
});

export const DossierResponseSchema = z.object({
  id: z.string().uuid(),
  countryCode: z.literal('CH'), // NFA-13
  isValuationStale: z.boolean(),
  property: z.object({
    livingArea: z.number().positive(),
    balconyArea: z.number().nonnegative().optional(),
    numberOfRooms: z.number().positive(),
    floorNumber: z.number(),
    location: z.object({ address: AdresseSchema }),
  }),
  valuationSale: ValuationSaleSchema,
});

export type DossierResponse = z.infer<typeof DossierResponseSchema>;
