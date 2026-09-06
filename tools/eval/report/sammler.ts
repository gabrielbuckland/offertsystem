/**
 * Keine Modellformel. Sammelt die Artefakte aller Plaene ueber ihre latest-Zeiger.
 *
 * Die Herkunft steht ausdruecklich dabei, weil ein fehlendes Artefakt eine Abhaengigkeit
 * auf einen anderen Plan ist und nicht ein Fehler dieses Werkzeugs: Der Abbruch zeigt
 * einen Reihenfolgefehler an — ein Plan ist noch nicht gelaufen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leseLatest, repoWurzel } from '../shared/artefakt.ts';

export const PFLICHTARTEFAKTE = [
  'tests', 'scenarios', 'property', 'config', 'integration', 'contract',
  'eval/oat', 'eval/degression', 'eval/tornado',
] as const;

export const KUERARTEFAKTE = [] as const;

export const ERZEUGER: Readonly<Record<string, string>> = {
  tests: 'P5 Aufgabe 16', scenarios: 'P2', property: 'P2', config: 'P2',
  contract: 'P3', integration: 'P3', 'eval/oat': 'P5 Aufgabe 7',
  'eval/degression': 'P5 Aufgabe 10', 'eval/tornado': 'P5 Aufgabe 12',
};

export const DATEINAME: Readonly<Record<string, string>> = {
  tests: 'tests.json', scenarios: 'szenarien.json', property: 'properties.json',
  config: 'config-validation.json', integration: 'integration.json',
  contract: 'contract.json', 'eval/oat': 'oat.json', 'eval/degression': 'margin.json',
  'eval/tornado': 'tornado.json',
};

export interface Artefaktsatz {
  readonly inhalte: Readonly<Record<string, unknown>>;
  readonly pfade: Readonly<Record<string, string>>;
  readonly fehlend: readonly string[];
  readonly vollstaendig: boolean;
}

export function sammle(wurzel: string = repoWurzel()): Artefaktsatz {
  const inhalte: Record<string, unknown> = {};
  const pfade: Record<string, string> = {};
  const fehlend: string[] = [];
  for (const instrument of [...PFLICHTARTEFAKTE, ...KUERARTEFAKTE]) {
    try {
      const verzeichnis = leseLatest(wurzel, instrument);
      const pfad = join(verzeichnis, DATEINAME[instrument] ?? '');
      if (!existsSync(pfad)) { fehlend.push(instrument); continue; }
      inhalte[instrument] = JSON.parse(readFileSync(pfad, 'utf8'));
      pfade[instrument] = pfad;
    } catch {
      fehlend.push(instrument);
    }
  }
  const fehlendPflicht = fehlend.filter(
    (i) => (PFLICHTARTEFAKTE as readonly string[]).includes(i),
  );
  return {
    inhalte, pfade, fehlend: fehlendPflicht, vollstaendig: fehlendPflicht.length === 0,
  };
}

/** Abbruchmeldung mit Herkunft: das fehlende Artefakt stammt oft aus einem anderen Plan. */
export function meldeFehlend(fehlend: readonly string[]): string {
  return fehlend
    .map((i) => `artifacts/${i}/${DATEINAME[i] ?? '?'} fehlt — erzeugt von ${ERZEUGER[i] ?? '?'}`)
    .join('\n');
}

/** sec:eval_design sagt zu, dass der Startwert je Testlauf im Protokoll erscheint. */
export function pruefeSeed(inhalte: Readonly<Record<string, unknown>>): void {
  const tests = inhalte['tests'] as { seed?: number | null } | undefined;
  const property = inhalte['property'] as { seed?: number | null } | undefined;
  const seed = tests?.seed ?? property?.seed;
  if (seed === null || seed === undefined) {
    throw new Error(
      'Kein seed in den Artefakten. sec:eval_design verlangt den Ausweis je Testlauf; '
      + 'der Anhang wird nicht erzeugt.',
    );
  }
}
