/**
 * Keine Formel. Herkunftskennzeichnung der Offerte (Spec 05 §2, A-13, A-14, 3.5.2).
 *
 * Die Trennung liegt bewusst im Typsystem und nicht in der Vorlage: Sie traegt die
 * Vertragskonformitaet und darf nicht in der austauschbaren Darstellungsschicht
 * liegen. Eine Vermischung der vier Klassen ist damit ein Uebersetzungsfehler und
 * kein Reviewbefund.
 *
 * Regel 1 aus Spec 05 §2.2: Es gibt keine klassenuebergreifende Aggregation. Eine
 * Ableitung ueber Klassengrenzen erzeugt eine NEUE Klasse und fuehrt die
 * Eingangsgroessen als eigene Felder weiter.
 */
import { z, type ZodTypeAny } from 'zod';

export type Herkunft =
  | 'pricehubble'
  | 'local-derivation'
  | 'marketer-adjustment'
  | 'local-calculation';

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
};

/**
 * Regel 2 aus Spec 05 §2.2: kein Aufweichen beim Serialisieren. `.strict()` haelt
 * ein zusaetzliches Feld auf, `z.literal` eine fremde oder fehlende Klasse — die
 * Herkunft wird nie ergaenzt, sondern verlangt.
 */
export function provenancedSchema<S extends ZodTypeAny, P extends Herkunft>(
  wertSchema: S,
  klasse: P,
) {
  return z.object({ value: wertSchema, provenance: z.literal(klasse) }).strict();
}
