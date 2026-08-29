// Keine Formel; fuehrt die Bezeichner der Normalisierungsstrategien (Brief §5.5, S-07).
// BEWUSST IMPORTFREI: config/typen.ts leitet `StrategieBezeichner` von hier ab, waehrend
// die Strategien ihrerseits `FaktorParameter` aus config/typen.ts beziehen — ein Import
// an dieser Stelle schloesse den Kreis.
//
// Eine neue Strategie ergaenzt hier ihren Bezeichner samt JSON-Schreibweise und
// registriert sich in registry.ts. Schema (Ebene 1, CFG_STRATEGY_UNKNOWN) und
// Uebersetzung (PE-02) leiten die zulaessigen Werte aus dieser Liste ab; eine
// Codeaenderung ausserhalb von normalization/ ist nicht noetig (E-15, Messlatte 6.3).

/** Kern-Schreibweise der implementierten Strategien (Spec 03 §7.5). */
export const STRATEGIE_BEZEICHNER = ['min-max', 'z-score'] as const;

export type StrategieBezeichner = (typeof STRATEGIE_BEZEICHNER)[number];

/**
 * JSON-Schreibweise (Spec 02) je Kern-Bezeichner. `satisfies` erzwingt Vollstaendigkeit:
 * Ein Bezeichner ohne Schreibweise bricht die Uebersetzung zur Uebersetzungszeit,
 * nicht zur Laufzeit (Totalitaet, PE-01).
 */
export const ROH_SCHREIBWEISE = {
  'min-max': 'minmax',
  'z-score': 'zscore',
} as const satisfies Record<StrategieBezeichner, string>;

export type RohStrategieBezeichner = (typeof ROH_SCHREIBWEISE)[StrategieBezeichner];
