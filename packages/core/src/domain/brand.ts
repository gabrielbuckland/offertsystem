/**
 * Keine Formel. Markentyp: Er traegt keine Laufzeitkosten, die Marke existiert nur
 * im Typsystem.
 */
export type Branded<T, B extends string> = T & { readonly __brand: B };
