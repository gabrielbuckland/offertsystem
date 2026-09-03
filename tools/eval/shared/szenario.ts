/**
 * Keine Modellformel. Lader der Szenario-Fixtures.
 *
 * S4a und S4b liegen als zwei eigenstaendige Dateien vor (`S4a.json`, `S4b.json`), nicht
 * als eine Datei mit einem Feld `varianten`. Ein Zweig dafuer waere toter Code, der eine
 * Struktur behauptet, die es nicht gibt. Geladen wird deshalb je Datei ein Szenario.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoWurzel } from './artefakt.ts';

export interface Anpassung {
  readonly a_i: number;
  readonly begruendung: string;
}

export interface SzenarioEinheit {
  readonly unit_id: string;
  readonly typ_id: string;
  readonly A_innen: number;
  readonly A_aussen: number;
  readonly anpassungen: readonly Anpassung[];
}

export interface SzenarioTyp {
  readonly typ_id: string;
  readonly zimmer: number;
  readonly A_ref_innen: number;
  readonly A_ref_aussen: number;
  readonly P_ref_rappen: number | null;
}

export interface Szenario {
  readonly szenario_id: string;
  readonly bezeichnung: string;
  readonly lage: { readonly adresse: string; readonly plz: string; readonly ort: string };
  readonly wohnungstypen: readonly SzenarioTyp[];
  readonly einheiten: readonly SzenarioEinheit[];
  readonly aufwandfaktoren: Readonly<Record<string, number>>;
  readonly lagescores: Readonly<Record<string, number>>;
  readonly lagedaten_herkunft: 'synthetisch' | 'aufgezeichnet';
  readonly zeitstempel: string;
}

const VERZEICHNIS = join('packages', 'core', 'test', 'fixtures', 'scenarios');

export function ladeSzenarien(wurzel: string = repoWurzel()): readonly Szenario[] {
  const ordner = join(wurzel, VERZEICHNIS);
  return readdirSync(ordner)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(ordner, n), 'utf8')) as Szenario);
}
