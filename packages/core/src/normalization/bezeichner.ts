// Keine Formel; fuehrt die Bezeichner der Normalisierungsstrategien (S-07).
// BEWUSST IMPORTFREI: config/typen.ts leitet `StrategieBezeichner` von hier ab, waehrend
// die Strategien ihrerseits `FaktorParameter` aus config/typen.ts beziehen — ein Import
// an dieser Stelle schloesse den Kreis.
//
// Eine neue Strategie ergaenzt hier ihren Bezeichner samt JSON-Schreibweise (E-15).

/** Kern-Schreibweise der implementierten Strategien. */
export const STRATEGIE_BEZEICHNER = ['min-max', 'wurzel-min-max', 'z-score'] as const;

export type StrategieBezeichner = (typeof STRATEGIE_BEZEICHNER)[number];

/**
 * JSON-Schreibweise je Kern-Bezeichner. `satisfies` erzwingt Vollstaendigkeit:
 * Ein Bezeichner ohne Schreibweise bricht die Uebersetzung zur Uebersetzungszeit,
 * nicht zur Laufzeit (Totalitaet, PE-01).
 */
export const ROH_SCHREIBWEISE = {
  'min-max': 'minmax',
  'wurzel-min-max': 'wurzelminmax',
  'z-score': 'zscore',
} as const satisfies Record<StrategieBezeichner, string>;

export type RohStrategieBezeichner = (typeof ROH_SCHREIBWEISE)[StrategieBezeichner];
