/**
 * Keine Modellformel. Erweiterbarkeitsmessung (Spec 06 §7.3, E-15, PE-16).
 *
 * ABWEICHUNG VOM PLAN: Instrument ist `extension`, nicht `eval/extension` — der
 * Artefaktschreiber setzt `artifacts/eval/` bereits selbst davor.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bildeKopf, repoWurzel, schreibeArtefakt } from '../shared/artefakt.ts';
import { BASIS_KONFIG_DATEI } from '../shared/konfig.ts';
import { aufloesen, commitsZwischen, numstat, tagVorhanden } from './git.ts';
import { fasseZusammen } from './klassifikation.ts';
import {
  SCOPE_REGELFALL,
  SCOPE_SONDERFALL,
  fuehreBoundaryPruefungAus,
  kernstufenBeruehrt,
  pruefeFaktormengeDatengetrieben,
  pruefeZuschnitt,
} from './kern.ts';

export const TAGS = {
  regelfall: { vorher: 'eval/ff1b-vorher', nachher: 'eval/ff1b-nachher' },
  sonderfall: { vorher: 'eval/ff1b-strategie-vorher', nachher: 'eval/ff1b-strategie-nachher' },
} as const;

export function messe(
  variante: 'regelfall' | 'sonderfall', wurzel: string = repoWurzel(),
): Record<string, unknown> {
  const tags = TAGS[variante];
  for (const tag of [tags.vorher, tags.nachher]) {
    if (!tagVorhanden(tag, wurzel)) {
      throw new Error(
        `Tag ${tag} fehlt. Prozedur in docs/testdoku/erweiterung-risikoindex.md befolgen.`);
    }
  }
  const scope = variante === 'regelfall' ? SCOPE_REGELFALL : SCOPE_SONDERFALL;
  const commits = commitsZwischen(tags.vorher, tags.nachher, wurzel);
  const zuschnitt = pruefeZuschnitt(commits, scope);
  if (!zuschnitt.sauber) {
    return {
      variante, messung_verweigert: true, zuschnitt,
      grund: 'Commits ausserhalb des Erweiterungsscopes; eine stillschweigend falsche '
        + 'Zahl waere schlechter als keine.',
    };
  }

  const eintraege = numstat(tags.vorher, tags.nachher, wurzel);
  const kategorien = fasseZusammen(eintraege);
  const beruehrteKernstufen = kernstufenBeruehrt(kategorien.code.dateiliste);
  const boundary = fuehreBoundaryPruefungAus(wurzel);
  const pipelineDateien = beruehrteKernstufen.filter((p) => p.includes('/pipeline/'));
  const quellen = kategorien.code.dateiliste
    .filter((p) => p.endsWith('.ts'))
    .map((p) => readFileSync(join(wurzel, p), 'utf8'));
  const datengetrieben = pruefeFaktormengeDatengetrieben(quellen);

  return {
    variante,
    messung_verweigert: false,
    refs: {
      vorher: tags.vorher, nachher: tags.nachher,
      vorher_hash: aufloesen(tags.vorher, wurzel),
      nachher_hash: aufloesen(tags.nachher, wurzel),
    },
    commits: commits.map((c) => ({ hash: c.hash, betreff: c.betreff })),
    metrik_1_und_2: kategorien.code,
    konfiguration: kategorien.konfiguration,
    test: kategorien.test,
    sonstiges: kategorien.sonstiges,
    kern_unversehrt: boundary.erfolg && beruehrteKernstufen.length === 0,
    kernstufen_pipeline_unveraendert: pipelineDateien.length === 0,
    kernstufen_beruehrt: beruehrteKernstufen,
    boundary_report: { erfolg: boundary.erfolg, ausgabe: boundary.ausgabe.slice(0, 20_000) },
    faktormenge_datengetrieben: datengetrieben.datengetrieben,
    faktormenge_befunde: datengetrieben.befunde,
    zeitaufwand_min: null,
    hinweis_zeitaufwand:
      'Nicht aus der Versionsgeschichte erhebbar (O-04); manuell nachzutragen und als '
      + 'solches gekennzeichnet.',
  };
}

export function hauptlauf(wurzel: string = repoWurzel()): string {
  const kopf = bildeKopf('extension', BASIS_KONFIG_DATEI, 1, wurzel);
  const regelfall = messe('regelfall', wurzel);
  let sonderfall: Record<string, unknown>;
  try {
    sonderfall = messe('sonderfall', wurzel);
  } catch (fehler) {
    sonderfall = {
      variante: 'sonderfall', nicht_durchgefuehrt: true,
      grund: fehler instanceof Error ? fehler.message : String(fehler),
    };
  }
  return schreibeArtefakt(wurzel, kopf, {
    'extension.json': `${JSON.stringify({ kopf, regelfall, sonderfall }, null, 2)}\n`,
  });
}

if (import.meta.filename === process.argv[1]) {
  process.stdout.write(`Erweiterbarkeits-Artefakt geschrieben: ${hauptlauf()}\n`);
}
