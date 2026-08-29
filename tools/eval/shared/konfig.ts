/**
 * Keine Modellformel — Ausnahme: `normiereMitKappung` (siehe unten).
 *
 * EINE Stelle, an der eine Werkzeugvariante die Validierung passiert: Die globale
 * Randbedingung «kein Werkzeug rechnet eine unzulaessige Konfiguration» (I-21) haengt so
 * an einer einzigen, getesteten Funktion statt an jedem Aufrufort neu.
 *
 * Import mit `.ts`-Endung statt `.js`: laeuft ohne Aufloesungshaken sowohl unter
 * `node --experimental-strip-types` als auch unter Vitest (`allowImportingTsExtensions`
 * in `tools/tsconfig.json`).
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

/** PE-01: `wert` ist der Kerntyp (Rechengrundlage), `rohWert` die Rohform, auf der
 * Varianten gebildet werden, weil nur sie Eingabe der Validierung ist. */
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
 * Suche ueber Quelle/Quellschluessel, nicht ueber den Faktorbezeichner: Ein fest
 * verdrahteter Bezeichner waere die faktorspezifische Sonderbehandlung, die I-13
 * ausschliesst (PE-03).
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
 * Zweitimplementierung derselben Formel, bewusst: Der Margen-Rechner arbeitet analytisch
 * ohne Pipeline-Durchlauf (Spec 06 §7.2); ein Test prueft sie gegen die
 * Normalisierungsstufe des Kerns.
 */
export function normiereMitKappung(roh: number, min: number, max: number): number {
  if (min === max) throw new Error('CFG_NORM_BOUNDS: min und max sind identisch');
  const wert = (roh - min) / (max - min);
  return Math.min(1, Math.max(0, wert));
}
