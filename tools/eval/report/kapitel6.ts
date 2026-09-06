import { hinweiskopf, latexEscape, tabelle, zahlDeCh } from './latex.ts';
import type { Testfall } from './vitest-reporter.ts';
import { gewichteteAbdeckung, type CoverageArtefakt } from './a5.ts';

export function p2Stufen(
  tests: { readonly faelle: readonly Testfall[] },
  coverage: CoverageArtefakt,
): string {
  // Trennzeichen am Ende noetig, sonst zaehlt 'stufe2' auch stufe2a mit.
  const stufen = [
    ['Stufe 1 — Eingabe', 'stufe1.', 'stufe1-'],
    ['Stufe 2 — Verkaufssumme', 'stufe2.', 'stufe2-'],
    ['Stufe 2a — abgeleitete Faktoren', 'stufe2a.', 'stufe2a-'],
    ['Stufe 3 — Normalisierung', 'stufe3.', 'stufe3-'],
    ['Stufe 4 — Gewichtung', 'stufe4.', 'stufe4-'],
    ['Stufe 5 — Honorar', 'stufe5.', 'stufe5-'],
  ] as const;
  const zeilen = stufen.map(([anzeige, testMuster, quellMuster]) => {
    const passend = tests.faelle.filter((f) => f.datei.includes(testMuster));
    const abdeckung = gewichteteAbdeckung(coverage, quellMuster, 'lines');
    return [
      latexEscape(anzeige),
      `${passend.length}`,
      abdeckung === null ? '--' : zahlDeCh(abdeckung, 2),
      passend.every((f) => f.zustand !== 'fail') ? 'bestanden' : 'nicht bestanden',
    ];
  });
  return hinweiskopf('artifacts/tests + artifacts/coverage') + tabelle({
    spalten: ['p{0.36\\textwidth}', 'r', 'r', 'l'],
    kopf: ['Pipeline-Stufe', 'Testfälle', 'Zeilenabdeckung \\%', 'Ergebnis'],
    zeilen,
    beschriftung: 'Testergebnisse je Pipeline-Stufe mit Zeilenabdeckung. Die Zuordnung '
      + 'erfolgt über den Dateinamen der Testdatei. Fälle ohne Stufenbezug erscheinen '
      + 'nicht in dieser Tabelle.',
    label: 'tab:p2_stufen',
  });
}

export interface KonfigArtefakt {
  readonly konfigVersion: string;
  readonly positivlauf: Readonly<Record<string, unknown>>;
  readonly negativmatrix: readonly {
    readonly datei: string; readonly verletzung: string;
    readonly erwarteterCode: string; readonly tatsaechlicheCodes: readonly string[];
    readonly ergebnisObjektErzeugt: boolean; readonly status: string;
  }[];
  readonly konstruktivAusgeschlossen: readonly {
    readonly fall: string; readonly begruendung: string; readonly status: string;
  }[];
}
