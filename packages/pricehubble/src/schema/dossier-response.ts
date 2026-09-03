/** Keine Formel. Contract-Schema der Dossier-Antwort (Spec 04 §1.3). */
import { z } from 'zod';
import { ValuationSaleSchema } from './valuation-sale.js';

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
    // Optional wie `balconyArea`: Ein reales Dossier fuehrt das Feld nicht zwingend.
    // Der Adapter SETZT es beim PATCH, liest es aber nie zurueck.
    floorNumber: z.number().optional(),
    location: z.object({ address: AdresseSchema }),
  }),
  valuationSale: ValuationSaleSchema,
});

export type DossierResponse = z.infer<typeof DossierResponseSchema>;
