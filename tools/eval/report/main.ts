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
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { leseLatest, repoWurzel } from '../shared/artefakt.ts';
import {
  a5Coverage, a5Uebersicht, type CoverageArtefakt, type TestArtefakt,
} from './a5.ts';
import {
  p2Stufen,
  type KonfigArtefakt,
} from './kapitel6.ts';
import { pruefeBeispielOfferte } from './offerte.ts';
import { meldeFehlend, pruefeSeed, sammle } from './sammler.ts';

export interface Laufoptionen {
  readonly main?: string | null;
  readonly wurzel?: string;
  /** Ohne Beispiel-Offerte laufen lassen; die Pruefung wird dann uebersprungen. */
  readonly ohneOfferte?: boolean;
  /**
   * Abweichender Ort der Abdeckungsdatei, gebraucht im eigenen Abnahmetest: Er laeuft
   * INNERHALB des Testlaufs, der die Datei erst am Ende schreibt.
   */
  readonly coveragePfad?: string;
}

export function hauptlauf(opt: Laufoptionen = {}): readonly string[] {
  // `undefined` laesst die Umgebung zu; ausdrueckliches `null` heisst "kein MAIN" und
  // darf nicht aus der Umgebung nachgefuellt werden.
  const main = opt.main !== undefined ? opt.main : (process.env['BA_MAIN'] ?? null);
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

  const anhang: Record<string, string> = {
    'a5-uebersicht.tex': a5Uebersicht(tests, zaehleContractTests(wurzel)),
    'a5-coverage.tex': a5Coverage(coverage),
  };
  const kapitel: Record<string, string> = {
    'p2-stufen.tex': p2Stufen(tests, coverage),
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
  for (const name of ['tornado-Hmin.pdf']) {
    copyFileSync(join(tornado, name), join(bilder, name));
    geschrieben.push(join(bilder, name));
  }
  return geschrieben;
}

/**
 * Zaehlt die Contract Tests aus dem juengsten Testartefakt, dessen Faelle vollstaendig
 * im Contract-Projekt liegen. Der Contract-Lauf traegt den latest-Zeiger bewusst nicht
 * (F-077); sein Zeitstempelverzeichnis bleibt aber stehen und ist die Zaehlquelle.
 */
function zaehleContractTests(wurzel: string): number | null {
  const ablage = join(wurzel, 'artifacts', 'tests');
  if (!existsSync(ablage)) return null;
  let neuester: number | null = null;
  for (const eintrag of readdirSync(ablage).sort()) {
    const pfad = join(ablage, eintrag, 'tests.json');
    if (!existsSync(pfad)) continue;
    try {
      const inhalt = JSON.parse(readFileSync(pfad, 'utf8')) as {
        faelle?: readonly { datei: string }[];
      };
      const faelle = inhalt.faelle ?? [];
      if (faelle.length > 0
          && faelle.every((f) => f.datei.startsWith('packages/pricehubble/test/contract/'))) {
        neuester = faelle.length;
      }
    } catch {
      // Unlesbares Altartefakt: ueberspringen statt den Lauf abzubrechen.
    }
  }
  return neuester;
}

if (import.meta.filename === process.argv[1]) {
  for (const pfad of hauptlauf()) process.stdout.write(`${pfad}\n`);
}
