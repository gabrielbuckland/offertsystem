/**
 * Keine Modellformel — mit einer benannten Ausnahme (`normiereMitKappung`, siehe unten).
 *
 * EINE Stelle, an der eine Werkzeugvariante die Validierung passiert. Damit ist die
 * globale Randbedingung «kein Werkzeug rechnet eine unzulaessige Konfiguration» (I-21)
 * nicht an jedem Aufrufort neu zu erfuellen, und der Nachweis haengt an einer einzigen,
 * getesteten Funktion.
 *
 * ABWEICHUNG VOM PLAN, bewusst: Der Kern wird mit `.ts`-Endung importiert, nicht mit
 * `.js`. Das ist die im Werkzeugverzeichnis bereits etablierte Form
 * (`tools/eval/config-validation.ts`); sie laeuft ohne Aufloesungshaken sowohl unter
 * `node --experimental-strip-types` als auch unter Vitest. `allowImportingTsExtensions`
 * ist in `tools/tsconfig.json` gesetzt.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseKonfiguration } from '../../../packages/core/src/index.ts';
import type {
  FaktorParameter,
  Konfiguration,
  KonfigurationsFehler,
  RohKonfiguration,
} from '../../../packages/core/src/index.ts';
import { repoWurzel } from './artefakt.ts';

export const BASIS_KONFIG_DATEI = 'config/company-defaults.json';

export function ladeBasisRoh(wurzel: string = repoWurzel()): unknown {
  return JSON.parse(readFileSync(join(wurzel, BASIS_KONFIG_DATEI), 'utf8'));
}

export function klone<T>(wert: T): T {
  return structuredClone(wert);
}

export type Validierung =
  | { readonly ok: true; readonly wert: Konfiguration; readonly rohWert: RohKonfiguration }
  | { readonly ok: false; readonly fehler: readonly KonfigurationsFehler[] };

/**
 * Kapselt PE-01: `parseKonfiguration` liefert Kerntyp und validierte Rohform als Paar.
 * `wert` ist der Kerntyp (Rechengrundlage), `rohWert` die Rohform (Variantenbildung) —
 * Varianten werden auf der Rohform gebildet, weil nur sie Eingabe der Validierung ist.
 */
export function validiere(roh: unknown): Validierung {
  const ergebnis = parseKonfiguration(roh);
  return ergebnis.ok
    ? { ok: true, wert: ergebnis.wert.kern, rohWert: ergebnis.wert.roh }
    : { ok: false, fehler: ergebnis.fehler };
}

/** Bricht ab, wenn die Standardkonfiguration selbst fehlerhaft ist. */
export function ladeBasis(wurzel: string = repoWurzel()): Konfiguration {
  const ergebnis = validiere(ladeBasisRoh(wurzel));
  if (!ergebnis.ok) {
    const liste = ergebnis.fehler
      .map((f) => `${f.code} @ ${f.pfad}: ${JSON.stringify(f.parameter)}`)
      .join('\n');
    throw new Error(`Standardkonfiguration ist ungueltig:\n${liste}`);
  }
  return ergebnis.wert;
}

export interface Umfangfaktor {
  readonly faktorId: string;
  readonly parameter: FaktorParameter;
}

/** Deterministische Iteration ueber die Faktor-Map des Kerntyps. */
export function sortiereMap<T>(
  map: ReadonlyMap<string, T>,
): readonly (readonly [string, T])[] {
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Gesucht wird ueber Quelle und Quellschluessel, NICHT ueber den Faktorbezeichner: Ein
 * fest verdrahteter Bezeichner waere genau die faktorspezifische Sonderbehandlung, die
 * I-13 ausschliesst. Der Faktorschluessel darf beliebig heissen; massgeblich ist, dass er
 * die Einheitenzahl verarbeitet (PE-03).
 */
export function findeUmfangfaktor(k: Konfiguration): Umfangfaktor | null {
  for (const [faktorId, parameter] of sortiereMap(k.faktoren)) {
    if (parameter.quelle === 'abgeleitet' && parameter.quellSchluessel === 'einheitenzahl') {
      return { faktorId, parameter };
    }
  }
  return null;
}

/**
 * eq:normalisierung inkl. aeusserer Kappung; `min > max` ist gewollte Umpolung.
 *
 * Das ist eine ZWEITIMPLEMENTIERUNG derselben Formel. Sie ist zulaessig und hier
 * erwuenscht, weil der Margen-Rechner analytisch arbeitet und keinen Pipeline-Durchlauf
 * verwendet (Spec 06 §7.2); ein eigener Test prueft sie gegen die Normalisierungsstufe
 * des Kerns, sodass ein Auseinanderlaufen auffaellt.
 */
export function normiereMitKappung(roh: number, min: number, max: number): number {
  if (min === max) throw new Error('CFG_NORM_BOUNDS: min und max sind identisch');
  const wert = (roh - min) / (max - min);
  return Math.min(1, Math.max(0, wert));
}
