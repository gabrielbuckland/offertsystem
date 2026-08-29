// Keine Formel. Einziger Aufloesungspunkt des Strategy Pattern (Brief §5.5): bildet
// jeden Bezeichner aus bezeichner.ts auf seine Strategie ab. Der Record-Typ erzwingt
// Vollstaendigkeit — ein Bezeichner ohne registrierte Strategie bricht die Uebersetzung
// zur Uebersetzungszeit, nicht zur Laufzeit.
import type { StrategieBezeichner } from './bezeichner.js';
import { minMax } from './min-max.js';
import type { Normalisierungsstrategie } from './strategie.js';
import { zScore } from './z-score.js';

const register: Readonly<Record<StrategieBezeichner, Normalisierungsstrategie>> = Object.freeze({
  'min-max': minMax,
  'z-score': zScore,
});

/**
 * Total; kein Result. `StrategieBezeichner` ist eine Literal-Union ueber genau die
 * implementierten Strategien, und das Konfigurationsschema wird aus derselben Liste
 * abgeleitet — ein unbekannter Bezeichner ist Ladezeitfehler CFG_STRATEGY_UNKNOWN (S-07).
 */
export function loeseStrategieAuf(bezeichner: StrategieBezeichner): Normalisierungsstrategie {
  return register[bezeichner];
}

/** Aufzaehlung des Registers; Grundlage des Property-Tests zu I-22. */
export function alleStrategien(): readonly Normalisierungsstrategie[] {
  return Object.values(register);
}
