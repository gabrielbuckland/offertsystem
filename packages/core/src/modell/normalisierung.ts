// eq:normalisierung — x_dach = min(1, max(0, (x - x_min) / (x_max - x_min))).
// Einziger Aufloesungspunkt des Strategy Pattern (Brief §5.5). Vertrag: das Ergebnis liegt
// garantiert in [0, 1] fuer jeden endlichen Rohwert (I-22); hoeher = aufwandintensiver.
// Die Umpolung liegt in den Daten (vertauschte Grenzen), nicht im Code (I-13).
import { score, type Score } from '../domain/geld.js';
import type { FaktorId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import type { FaktorParameter, StrategieBezeichner } from '../config/typen.js';

export interface NormalisierterFaktor {
  readonly faktorId: FaktorId;
  readonly rohwert: number; // x_d
  readonly grenzeMin: number; // x_d_min — darf groesser als grenzeMax sein
  readonly grenzeMax: number; // x_d_max
  readonly strategie: StrategieBezeichner;
  readonly gekappt: boolean; // Rohwert lag ausserhalb, I-11
  readonly normiert: Score; // x_dach_d in [0, 1]
}

export interface Normalisierungsstrategie {
  readonly bezeichner: StrategieBezeichner;
  normalisiere(
    rohwert: number,
    parameter: FaktorParameter,
    faktorId: FaktorId,
  ): Result<NormalisierterFaktor, StufenFehler>;
}

function grenzenIdentisch(
  faktorId: FaktorId,
  parameter: FaktorParameter,
  wert: number,
): Result<never, StufenFehler> {
  return fehlschlag(
    stufenFehler(3, 'NORM_GRENZEN_IDENTISCH',
      { faktorId, bezeichnung: parameter.bezeichnung, wert },
      { faktor: faktorId }),
  );
}

/** eq:normalisierung. Die aeussere Kappung ist Teil der Formel, keine Nachbehandlung. */
const minMax: Normalisierungsstrategie = {
  bezeichner: 'min-max',
  normalisiere(rohwert, parameter, faktorId) {
    const { grenzeMin, grenzeMax } = parameter;
    if (grenzeMin === grenzeMax) return grenzenIdentisch(faktorId, parameter, grenzeMin);
    const roh = (rohwert - grenzeMin) / (grenzeMax - grenzeMin);
    const gekappt = roh < 0 || roh > 1;
    return ok({
      faktorId, rohwert, grenzeMin, grenzeMax, strategie: 'min-max', gekappt,
      normiert: score(Math.min(1, Math.max(0, roh))),
    });
  },
};

/**
 * Z-Score, ausschliesslich mit nachgelagerter Kappung zulaessig (Brief §5.5):
 *   z = (x - mu) / sigma ;  x_dach = min(1, max(0, (z + c) / (2c))).
 * Ohne die Kappung verliesse z das Zielintervall unbeschraenkt und braeche I-22.
 * Nachweisartefakt fuer den Sonderfall der Messlatte aus 6.3; heute von keinem Faktor
 * verwendet (offener Punkt O-03: Herkunft von mu und sigma).
 */
const zScore: Normalisierungsstrategie = {
  bezeichner: 'z-score',
  normalisiere(rohwert, parameter, faktorId) {
    const v = parameter.referenzverteilung;
    if (v === undefined) {
      throw new Error(`Faktor ${faktorId} nutzt z-score ohne Referenzverteilung — Defekt`);
    }
    if (v.standardabweichung === 0 || v.kappungSigma === 0) {
      return grenzenIdentisch(faktorId, parameter, v.standardabweichung);
    }
    const z = (rohwert - v.mittelwert) / v.standardabweichung;
    const roh = (z + v.kappungSigma) / (2 * v.kappungSigma);
    const gekappt = roh < 0 || roh > 1;
    return ok({
      faktorId, rohwert, grenzeMin: parameter.grenzeMin, grenzeMax: parameter.grenzeMax,
      strategie: 'z-score', gekappt, normiert: score(Math.min(1, Math.max(0, roh))),
    });
  },
};

const register: Readonly<Record<StrategieBezeichner, Normalisierungsstrategie>> = Object.freeze({
  'min-max': minMax,
  'z-score': zScore,
});

/**
 * Total; kein Result. `StrategieBezeichner` ist eine Literal-Union ueber genau die
 * implementierten Strategien, und das Konfigurationsschema wird aus derselben Union
 * abgeleitet — ein unbekannter Bezeichner ist Ladezeitfehler CFG_STRATEGY_UNKNOWN (S-07).
 */
export function loeseStrategieAuf(bezeichner: StrategieBezeichner): Normalisierungsstrategie {
  return register[bezeichner];
}

/** Aufzaehlung des Registers; Grundlage des Property-Tests zu I-22. */
export function alleStrategien(): readonly Normalisierungsstrategie[] {
  return Object.values(register);
}
