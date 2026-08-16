/**
 * Keine Modellformel. Erzeugt die LaTeX-Fragmente in das Berichtsverzeichnis.
 *
 * Der Zielort liegt ausserhalb des Code-Repositoriums und wird ueber `BA_MAIN` bezogen.
 * Ist die Variable nicht gesetzt, bricht der Generator ab, statt in ein geratenes
 * Verzeichnis zu schreiben.
 *
 * Ohne vollstaendigen Artefaktsatz entsteht kein Anhang: Ein fehlendes Artefakt ist ein
 * Reihenfolgefehler, und ein halb erzeugter Anhang saehe vollstaendig aus.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leseLatest, repoWurzel } from '../shared/artefakt.ts';
import {
  a5Coverage, a5Fehlerprotokoll, a5Protokolle, a5Testfaelle, a5Testplan, a5Toleranzen,
  type CoverageArtefakt, type Invariante, type TestArtefakt,
} from './a5.ts';
import {
  p1Szenarien, p2Invarianten, p2Konfigpruefung, p2Stufen,
  p4Erweiterung, p5Integration, p6Entkopplung, p7Marge, p7Sensitivitaet, p8Pruefpunkte,
  type ExtensionArtefakt, type KonfigArtefakt, type LaufArtefakt, type ManuellArtefakt,
  type MargenArtefakt, type OatZeile, type PropertyArtefakt, type SzenarienArtefakt,
} from './kapitel6.ts';
import { pruefeBeispielOfferte } from './offerte.ts';
import { meldeFehlend, pruefeSeed, sammle } from './sammler.ts';

export interface Laufoptionen {
  readonly main?: string | null;
  readonly wurzel?: string;
  /** Ohne Beispiel-Offerte laufen lassen; die Pruefung wird dann uebersprungen. */
  readonly ohneOfferte?: boolean;
  /**
   * Abweichender Ort der Abdeckungsdatei. Gebraucht wird das im eigenen Abnahmetest:
   * Er laeuft INNERHALB des Testlaufs, der die Datei erst am Ende schreibt — ohne diese
   * Moeglichkeit pruefte der Test den Stand des vorigen Laufs oder gar keinen.
   */
  readonly coveragePfad?: string;
}

export function hauptlauf(opt: Laufoptionen = {}): readonly string[] {
  const main = opt.main ?? process.env['BA_MAIN'] ?? null;
  if (main === null || main === '') {
    throw new Error(
      'BA_MAIN ist nicht gesetzt. Der Generator schreibt nach MAIN/appendix/generated und '
      + 'MAIN/chapters/generated und ratet kein Verzeichnis.',
    );
  }
  const wurzel = opt.wurzel ?? repoWurzel();
  const satz = sammle(wurzel);
  if (!satz.vollstaendig) {
    throw new Error(`Fehlende Pflichtartefakte:\n${meldeFehlend(satz.fehlend)}`);
  }
  pruefeSeed(satz.inhalte);

  const i = satz.inhalte;
  const tests = i['tests'] as TestArtefakt;
  const konfig = i['config'] as KonfigArtefakt;
  if (opt.ohneOfferte !== true) {
    pruefeBeispielOfferte(wurzel, { konfigVersion: konfig.konfigVersion });
  }

  const coveragePfad = opt.coveragePfad
    ?? join(wurzel, 'artifacts', 'coverage', 'coverage-summary.json');
  if (!existsSync(coveragePfad)) {
    throw new Error('artifacts/coverage/coverage-summary.json fehlt — erzeugt von P1');
  }
  const coverage = JSON.parse(readFileSync(coveragePfad, 'utf8')) as CoverageArtefakt;
  const invarianten = JSON.parse(readFileSync(
    join(wurzel, 'packages', 'core', 'test', 'property', 'invariants.json'), 'utf8'),
  ) as readonly Invariante[];

  const anhang: Record<string, string> = {
    'a5-testplan.tex': a5Testplan(tests),
    'a5-testfaelle.tex': a5Testfaelle(tests),
    'a5-protokolle.tex': a5Protokolle(tests),
    'a5-coverage.tex': a5Coverage(coverage),
    'a5-fehlerprotokoll.tex': a5Fehlerprotokoll(tests, i['property'] as PropertyArtefakt),
    'a5-toleranzen.tex': a5Toleranzen(invarianten),
  };
  const kapitel: Record<string, string> = {
    'p1-szenarien.tex': p1Szenarien(i['scenarios'] as SzenarienArtefakt),
    'p2-stufen.tex': p2Stufen(tests, coverage),
    'p2-invarianten.tex': p2Invarianten(i['property'] as PropertyArtefakt),
    'p2-konfigpruefung.tex': p2Konfigpruefung(konfig),
    'p4-erweiterung.tex': p4Erweiterung(i['eval/extension'] as ExtensionArtefakt),
    'p5-integration.tex': p5Integration(i['integration'] as LaufArtefakt),
    'p6-entkopplung.tex': p6Entkopplung(
      i['integration'] as LaufArtefakt, i['contract'] as LaufArtefakt),
    'p7-sensitivitaet.tex': p7Sensitivitaet(
      i['eval/oat'] as { zeilen: readonly OatZeile[] }),
    'p7-marge.tex': p7Marge(i['eval/degression'] as MargenArtefakt),
    // manual ist kein Pflichtartefakt; fehlt es, erscheint der Hinweis im Fragment.
    'p8-pruefpunkte.tex': p8Pruefpunkte((i['manual'] as ManuellArtefakt | undefined) ?? null),
  };

  const geschrieben: string[] = [];
  for (const [ordner, dateien] of [
    [join(main, 'appendix', 'generated'), anhang],
    [join(main, 'chapters', 'generated'), kapitel],
  ] as const) {
    mkdirSync(ordner, { recursive: true });
    for (const name of Object.keys(dateien).sort()) {
      const pfad = join(ordner, name);
      writeFileSync(pfad, dateien[name] ?? '', 'utf8');
      geschrieben.push(pfad);
    }
  }

  const bilder = join(main, 'images');
  mkdirSync(bilder, { recursive: true });
  const tornado = leseLatest(wurzel, 'eval/tornado');
  for (const name of ['tornado-V.pdf', 'tornado-Hmin.pdf', 'tornado-Hmax.pdf']) {
    copyFileSync(join(tornado, name), join(bilder, name));
    geschrieben.push(join(bilder, name));
  }
  return geschrieben;
}

if (import.meta.filename === process.argv[1]) {
  for (const pfad of hauptlauf()) process.stdout.write(`${pfad}\n`);
}
