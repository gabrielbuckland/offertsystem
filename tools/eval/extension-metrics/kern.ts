/**
 * Keine Modellformel. Zuschnittpruefung, Kern-Unversehrtheit und Datengetriebenheit.
 *
 * Die Messung ist WERTLOS, wenn zwischen den Tags Aenderungen liegen, die nicht zur
 * Erweiterung gehoeren (z. B. ein Formatierungslauf, der die Zeilenmetrik verschiebt, oder
 * ein Kern-Fix, der die Unversehrtheitsaussage kippt). Das Werkzeug VERWEIGERT deshalb die
 * Messung, statt eine stillschweigend falsche Zahl zu liefern.
 */
import { execFileSync } from 'node:child_process';
import { repoWurzel } from '../shared/artefakt.ts';
import type { Commit } from './git.ts';

export const SCOPE_REGELFALL: readonly RegExp[] = [
  /^config\//, /^packages\/[^/]+\/test\//, /^fixtures\//, /^docs\/testdoku\//,
];

export const SCOPE_SONDERFALL: readonly RegExp[] = [
  ...SCOPE_REGELFALL, /^packages\/core\/src\/normalization\//,
];

export interface Zuschnitt {
  readonly sauber: boolean;
  readonly stoerende: readonly {
    readonly hash: string;
    readonly betreff: string;
    readonly dateien_ausserhalb: readonly string[];
  }[];
}

export function pruefeZuschnitt(
  commits: readonly Commit[], scope: readonly RegExp[],
): Zuschnitt {
  const stoerende = commits
    .map((c) => ({
      hash: c.hash,
      betreff: c.betreff,
      dateien_ausserhalb: c.dateien.filter((d) => !scope.some((r) => r.test(d))),
    }))
    .filter((c) => c.dateien_ausserhalb.length > 0);
  return { sauber: stoerende.length === 0, stoerende };
}

/**
 * Kernstufen nach subsec:eval_design_ff1b: Normalisierung, Gewichtung, Ergebnisberechnung.
 * Der Sonderfall aendert `normalization/` bewusst und erhaelt deshalb `kern_unversehrt:
 * false` — kein Widerspruch, sondern die Aussage von 6.3: EINE Strategie-Klasse kommt
 * hinzu, ohne Aenderung des Pipeline-Kerns (dafuer `kernstufen_pipeline_unveraendert`).
 */
export const KERNSTUFEN: readonly RegExp[] = [
  /^packages\/core\/src\/pipeline\//,
  /^packages\/core\/src\/modell\//,
  /^packages\/core\/src\/normalization\//,
];

export function kernstufenBeruehrt(pfade: readonly string[]): readonly string[] {
  return pfade.filter((p) => KERNSTUFEN.some((r) => r.test(p)));
}

export function fuehreBoundaryPruefungAus(
  wurzel: string = repoWurzel(),
): { erfolg: boolean; ausgabe: string } {
  try {
    return {
      erfolg: true,
      ausgabe: execFileSync('npm', ['run', '--silent', 'lint'], {
        cwd: wurzel, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      }),
    };
  } catch (fehler) {
    const f = fehler as { stdout?: string; stderr?: string };
    return { erfolg: false, ausgabe: `${f.stdout ?? ''}${f.stderr ?? ''}` };
  }
}

/**
 * Die Messung ist nur dann eine Aussage ueber die ARCHITEKTUR statt ueber die
 * Implementierung, wenn die Faktormenge datengetrieben gefuehrt wird. Andernfalls
 * erzwaenge bereits das Typsystem eine Codeaenderung.
 */
const LITERALE_UNION = /type\s+FaktorId\s*=\s*'[^']+'(\s*\|\s*'[^']+')+/;

export function pruefeFaktormengeDatengetrieben(
  quellen: readonly string[],
): { datengetrieben: boolean; befunde: readonly string[] } {
  const befunde = quellen
    .filter((q) => LITERALE_UNION.test(q))
    .map((q) => `Literale Union von FaktorId gefunden: ${LITERALE_UNION.exec(q)?.[0] ?? ''}`);
  return { datengetrieben: befunde.length === 0, befunde };
}
