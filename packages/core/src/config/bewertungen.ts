// Keine Formel.
//
// Feldmenge und Aufzaehlungswerte der PriceHubble-Objekte `condition` und `quality`
// (docs.pricehubble.com, dossier_creation/valuation). Wissen ueber ein FREMDES
// Datenformat zum Zweck der Zurueckweisung — dieselbe Ausnahme, die schema.ts fuer die
// neun Lagescore-Namen traegt, nicht die Bevorzugung eines Faktors in der Rechnung.
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

export type Bewertungsfeld = typeof BEWERTUNGSFELDER[number];
export type Zustandswert = typeof ZUSTANDSWERTE[number];
export type Qualitaetswert = typeof QUALITAETSWERTE[number];
export type Zustandsbewertungen = z.infer<typeof ZustandsbewertungenSchema>;
export type Qualitaetsbewertungen = z.infer<typeof QualitaetsbewertungenSchema>;
