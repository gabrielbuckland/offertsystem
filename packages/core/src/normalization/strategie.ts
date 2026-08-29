// eq:normalisierung — Vertrag der Strategieschnittstelle (Strategy Pattern, Brief §5.5).
// Vertrag: das Ergebnis liegt garantiert in [0, 1] fuer jeden endlichen Rohwert (I-22);
// hoeher = aufwandintensiver. Die Umpolung liegt in den Daten (vertauschte Grenzen),
// nicht im Code (I-13).
import type { Score } from '../domain/geld.js';
import type { FaktorId } from '../domain/ids.js';
import { fehlschlag, type Result } from '../domain/result.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import type { FaktorParameter } from '../config/typen.js';
import type { StrategieBezeichner } from './bezeichner.js';

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

/** Gemeinsamer S-01-Fehlschlag der Strategien: entartete Grenzen, kein Ersatzwert. */
export function grenzenIdentisch(
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
