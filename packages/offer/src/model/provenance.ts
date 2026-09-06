// Keine Formel. A-13, A-14: Herkunftskennzeichnung der Offerte. Die Trennung liegt
// bewusst im Typsystem, nicht in der Vorlage, da sie Vertragskonformitaet traegt.
// Keine klassenuebergreifende Aggregation: eine Ableitung ueber Klassengrenzen
// erzeugt eine neue Klasse und fuehrt die Eingangsgroessen als eigene Felder weiter.
import { z, type ZodTypeAny } from 'zod';

export type Herkunft =
  | 'pricehubble'
  | 'local-derivation'
  | 'marketer-adjustment'
  | 'local-calculation'
  | 'marketer-decision';

export interface Provenanced<T, P extends Herkunft> {
  readonly value: T;
  readonly provenance: P;
}

export function herkunft<T, P extends Herkunft>(value: T, provenance: P): Provenanced<T, P> {
  return { value, provenance };
}

export const HERKUNFT_BESCHRIFTUNG: Readonly<Record<Herkunft, string>> = {
  'pricehubble': 'Bewertung PriceHubble',
  'local-derivation': 'systemseitige Ableitung',
  'marketer-adjustment': 'Anpassung Vermarkter',
  'local-calculation': 'lokale Kalkulation',
  'marketer-decision': 'Entscheid Vermarkter',
};

// .strict() haelt ein zusaetzliches Feld auf, z.literal eine fremde/fehlende Klasse —
// die Herkunft wird nie ergaenzt, sondern verlangt.
export function provenancedSchema<S extends ZodTypeAny, P extends Herkunft>(
  wertSchema: S,
  klasse: P,
) {
  return z.object({ value: wertSchema, provenance: z.literal(klasse) }).strict();
}
