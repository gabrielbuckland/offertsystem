/**
 * Keine Modellformel. Erzeugt die LaTeX-Fragmente des Anhangs A5 (Spec 06 §8.2).
 *
 * Der Generator liest AUSSCHLIESSLICH Artefakte. Handarbeit bleibt allein fuer die
 * einordnenden Saetze; kein Zahlenwert gelangt von Hand in den Bericht.
 *
 * Fehlende Testmetadaten erscheinen sichtbar als «METADATEN FEHLEN» — ein leeres Feld
 * saehe aus wie eine Angabe und waere schlimmer als eine sichtbare Luecke.
 */
import { hinweiskopf, latexEscape, longtable, zahlDeCh } from './latex.ts';
import type { PropertyArtefakt } from './kapitel6.ts';
import type { Testfall } from './vitest-reporter.ts';

export interface TestArtefakt {
  readonly kopf: {
    readonly zeitstempel: string;
    readonly git_commit: string;
    readonly node_version: string;
  };
  readonly seed: number | null;
  readonly faelle: readonly Testfall[];
}

export interface Invariante {
  readonly id: string;
  readonly kurztext: string;
  readonly kette: string;
  readonly typ: string;
  readonly wert: number;
  readonly begruendung: string;
}

export interface CoverageMass {
  readonly pct?: number;
  readonly covered?: number;
  readonly total?: number;
}

export interface CoverageEintrag {
  readonly lines?: CoverageMass;
  readonly branches?: CoverageMass;
}

export type CoverageArtefakt = Readonly<Record<string, CoverageEintrag>>;

/**
 * Zeilengewichtete Paketabdeckung: sum(covered) / sum(total) ueber alle Dateien des
 * Praefixes. Ein ungewichtetes Mittel der Datei-Prozentsaetze wuerde kleine Dateien
 * ueberrepraesentieren und hat im Kern 2,25 Prozentpunkte zu viel ausgewiesen
 * (Befund F-060 des Gutachtens vom 2026-08-28).
 */
export function gewichteteAbdeckung(
  coverage: CoverageArtefakt,
  praefix: string,
  art: 'lines' | 'branches',
): number | null {
  let covered = 0;
  let total = 0;
  for (const [pfad, eintrag] of Object.entries(coverage)) {
    if (pfad === 'total' || !pfad.includes(praefix)) continue;
    const mass = eintrag[art];
    if (typeof mass?.covered !== 'number' || typeof mass?.total !== 'number') {
      throw new Error(
        `Abdeckungseintrag ${pfad} ohne covered/total — Artefakt aus altem Lauf? `
        + 'coverage-summary.json neu erzeugen (npm run test:coverage).',
      );
    }
    covered += mass.covered;
    total += mass.total;
  }
  return total === 0 ? null : (100 * covered) / total;
}

const FEHLT = '\\textbf{METADATEN FEHLEN}';

function feld(wert: string | null): string {
  return wert === null ? FEHLT : latexEscape(wert);
}

function bezeichner(f: Testfall): string {
  // Gedankenstrich-Einschuebe aus Suite-/Testnamen werden fuer den Bericht in Kommata
  // ueberfuehrt (Stilregel); die Testnamen im Code bleiben unveraendert.
  const text = `${f.suite === null ? '' : `${f.suite}: `}${f.name}`;
  return latexEscape(text.replace(/\s+—\s+/gu, ', '));
}

const INSTRUMENTE: readonly (readonly [string, string, string])[] = [
  ['T1', 'Unit-Tests gegen unabhängige Referenz', 'Vitest, Referenz-CSV aus der Tabellenkalkulation'],
  ['T2', 'Parametrisierte Tests und Grenzwerte', 'Vitest test.each über Szenarien- und Grenzwerttabellen'],
  ['T3', 'Invarianten des Modells', 'fast-check auf Vitest, ein fixierter Seed je Lauf'],
  ['T4', 'Semantische Konfigurationsvalidierung', 'Zod-Schema und Invariantenprüfer im Ladepfad'],
  ['T5', 'Contract Tests', 'Zod-Antwortschema gegen Fixtures und Laufzeitantworten'],
  ['T6', 'Integrationstests mit Mock-API', 'Interface-Mock und MSW auf HTTP-Ebene, manipulierbarer Zeitgeber'],
  ['T7', 'Sensitivitätsanalyse (OAT)', 'eigenständiges Auswertungsprogramm tools/eval/oat'],
  ['T8', 'Manuelle Prüfung der Oberfläche', 'vorab festgelegte Prüfpunktliste, manuell abgearbeitet'],
];

export function a5Testplan(tests: TestArtefakt): string {
  const umgebung = [
    '\\begin{description}',
    `  \\item[Laufzeitumgebung] Node ${latexEscape(tests.kopf.node_version)}`,
    `  \\item[Commit des Laufs] \\texttt{${latexEscape(tests.kopf.git_commit)}}`,
    `  \\item[Zeitpunkt] ${latexEscape(tests.kopf.zeitstempel)}`,
    `  \\item[Startwert des Zufallsgenerators] ${tests.seed ?? '--'}`,
    '\\end{description}',
    '',
  ].join('\n');
  return hinweiskopf('artifacts/tests/<zeitstempel>/tests.json') + umgebung + longtable({
    spalten: ['l', 'p{0.34\\textwidth}', 'p{0.40\\textwidth}'],
    kopf: ['Nr.', 'Instrument', 'Werkzeug'],
    zeilen: INSTRUMENTE.map((i) => [i[0], latexEscape(i[1]), latexEscape(i[2])]),
    beschriftung: 'Teststrategie: eingesetzte Instrumente, Werkzeuge und Testumgebung.',
    label: 'tab:a5_testplan',
  });
}

export function a5Testfaelle(tests: TestArtefakt): string {
  // Abgedruckt werden die dokumentierten Faelle der Kernalgorithmik (mindestens ein
  // Metadatenfeld gesetzt; fehlende Felder erscheinen sichtbar als METADATEN FEHLEN).
  // Die uebrigen Faelle des Laufs stehen zusammengefasst im Protokoll. Ein Lauf ganz
  // ohne dokumentierte Faelle ist ein Reihenfolgefehler (alte Testbasis), kein leerer
  // Anhang.
  const dokumentiert = tests.faelle.filter(
    (f) => f.vorbedingung !== null || f.schritte !== null || f.erwartung !== null,
  );
  if (dokumentiert.length === 0) {
    throw new Error(
      'Kein Testfall traegt vollstaendige Metadaten (vorbedingung/schritte/erwartung). '
      + 'Testlauf mit annotierter Kernalgorithmik wiederholen (Spec 06 §8.2).',
    );
  }
  const zeilen = dokumentiert.map((f) => [
    bezeichner(f),
    feld(f.vorbedingung), feld(f.schritte), feld(f.erwartung),
    f.invariante === null ? '--' : latexEscape(f.invariante),
    f.anforderung === null ? '--' : latexEscape(f.anforderung),
  ]);
  return hinweiskopf('artifacts/tests/<zeitstempel>/tests.json') + longtable({
    spalten: ['p{0.24\\textwidth}', 'p{0.16\\textwidth}', 'p{0.18\\textwidth}',
              'p{0.18\\textwidth}', 'l', 'l'],
    kopf: ['Testfall', 'Vorbedingung', 'Schritte', 'Erwartungswert', 'Inv.', 'Anf.'],
    zeilen,
    beschriftung: 'Testfälle der Kernalgorithmik mit Vorbedingung, Schritten und '
      + 'Erwartungswert, automatisch aus den Testmetadaten erzeugt '
      + `(${zeilen.length} dokumentierte von ${tests.faelle.length} Testfällen des `
      + 'Laufs; die übrigen erscheinen zusammengefasst im Protokoll).',
    label: 'tab:a5_testfaelle',
  });
}

export function a5Protokolle(tests: TestArtefakt): string {
  if (tests.seed === null || tests.seed === undefined) {
    throw new Error('Protokoll ohne seed: sec:eval_design verlangt den Ausweis je Testlauf.');
  }
  const zaehle = (zustand: Testfall['zustand']): number =>
    tests.faelle.filter((f) => f.zustand === zustand).length;

  const kopf = [
    '\\begin{description}',
    `  \\item[Datum des Laufs] ${latexEscape(tests.kopf.zeitstempel)}`,
    `  \\item[Startwert des Zufallsgenerators (Seed)] ${tests.seed}`,
    '  \\item[Abgeleiteter Strom] Jitter-Quelle des Adapters: Seed \\(\\oplus\\) 1',
    `  \\item[Commit] \\texttt{${latexEscape(tests.kopf.git_commit)}}`,
    `  \\item[Laufzeitumgebung] Node ${latexEscape(tests.kopf.node_version)}`,
    `  \\item[Ergebnis] ${zaehle('pass')} bestanden, ${zaehle('fail')} fehlgeschlagen, `
      + `${zaehle('skip')} übersprungen`,
    '\\end{description}',
    '',
  ].join('\n');

  const zeilen = tests.faelle.map((f) => [
    latexEscape(f.datei),
    bezeichner(f),
    f.zustand === 'pass' ? 'bestanden' : f.zustand === 'fail' ? 'fehlgeschlagen' : 'übersprungen',
    f.dauer_ms === null ? '--' : `${f.dauer_ms}`,
    f.fehlermeldung === null ? '--' : latexEscape(f.fehlermeldung.slice(0, 160)),
  ]);

  return hinweiskopf('artifacts/tests/<zeitstempel>/tests.json') + kopf + longtable({
    spalten: ['p{0.26\\textwidth}', 'p{0.26\\textwidth}', 'l', 'r', 'p{0.20\\textwidth}'],
    kopf: ['Datei', 'Testfall', 'Ergebnis', 'ms', 'Kommentar'],
    zeilen,
    beschriftung: 'Testprotokoll des Laufs mit Datum, Ergebnis, Kommentar und Seed.',
    label: 'tab:a5_protokolle',
  });
}

export const ABDECKUNGSZIELE = [
  { paket: 'packages/core', anzeige: '@offert/core', zeilen: 90, branches: 85 },
  { paket: 'packages/pricehubble', anzeige: '@offert/pricehubble', zeilen: 80, branches: null },
  { paket: 'packages/offer', anzeige: '@offert/offer', zeilen: null, branches: null },
  { paket: 'apps/web', anzeige: '@offert/web', zeilen: null, branches: null },
] as const;

export function a5Coverage(coverage: CoverageArtefakt): string {
  const zeilen: string[][] = ABDECKUNGSZIELE.map((z) => {
    const l = gewichteteAbdeckung(coverage, z.paket, 'lines');
    const b = gewichteteAbdeckung(coverage, z.paket, 'branches');
    return [
      latexEscape(z.anzeige),
      l === null ? '--' : zahlDeCh(l, 2),
      b === null ? '--' : zahlDeCh(b, 2),
      z.zeilen === null ? 'kein Zeilenziel' : `$\\geq ${z.zeilen}\\,\\%$`,
      z.branches === null ? '--' : `$\\geq ${z.branches}\\,\\%$`,
    ];
  });
  const gesamt = coverage['total'];
  zeilen.push([
    '\\textbf{gesamt}',
    gesamt?.lines?.pct === undefined ? '--' : zahlDeCh(gesamt.lines.pct, 2),
    gesamt?.branches?.pct === undefined ? '--' : zahlDeCh(gesamt.branches.pct, 2),
    '--', '--',
  ]);

  return hinweiskopf('artifacts/coverage/coverage-summary.json') + longtable({
    spalten: ['l', 'r', 'r', 'l', 'l'],
    kopf: ['Bereich', 'Zeilen \\%', 'Branches \\%', 'Ziel Zeilen', 'Ziel Branches'],
    zeilen,
    beschriftung: 'Testabdeckung je Paket, zeilengewichtet aggregiert (abgedeckte durch '
      + 'gesamte Zeilen bzw. Zweige aller Dateien des Pakets). Die Zielwerte sind eine '
      + 'eigene Festlegung der Umsetzung; Abschnitt 4.4 der Arbeit verlangt Testabdeckung '
      + 'ohne Zielwert (R-05). Die Abdeckung ist ein notwendiges, kein hinreichendes '
      + 'Kriterium.',
    label: 'tab:a5_coverage',
  });
}

export function a5Fehlerprotokoll(
  tests: TestArtefakt, properties: PropertyArtefakt | null,
): string {
  const fehlgeschlagen = tests.faelle.filter((f) => f.zustand === 'fail');
  const gegenbeispiele = (properties?.properties ?? []).filter((p) => p.pass === false);
  const zeilen = [
    ...fehlgeschlagen.map((f) => [
      latexEscape(`${f.datei}: ${f.name}`), 'Unit/Integration',
      latexEscape((f.fehlermeldung ?? '--').slice(0, 200)), `${tests.seed ?? '--'}`,
    ]),
    ...gegenbeispiele.map((p) => [
      latexEscape(p.id), 'Property',
      latexEscape((p.gegenbeispiel ?? '--').slice(0, 200)),
      `${properties?.seed ?? tests.seed ?? '--'}`,
    ]),
  ];
  if (zeilen.length === 0) {
    return `${hinweiskopf('artifacts/tests + artifacts/property')
      }Im dokumentierten Lauf ist kein Testfall fehlgeschlagen.\n\n`;
  }
  return hinweiskopf('artifacts/tests + artifacts/property') + longtable({
    spalten: ['p{0.30\\textwidth}', 'l', 'p{0.34\\textwidth}', 'r'],
    kopf: ['Fall', 'Art', 'Befund bzw. minimiertes Gegenbeispiel', 'Seed'],
    zeilen,
    beschriftung: 'Fehlerprotokoll mit minimierten Gegenbeispielen und Seed; '
      + 'jeder Eintrag ist mit diesem Seed exakt wiederholbar.',
    label: 'tab:a5_fehlerprotokoll',
  });
}

export function a5Toleranzen(invarianten: readonly Invariante[]): string {
  return hinweiskopf('packages/core/test/property/invariants.json') + longtable({
    spalten: ['l', 'p{0.24\\textwidth}', 'l', 'l', 'r', 'p{0.28\\textwidth}'],
    kopf: ['ID', 'Invariante', 'Kette', 'Typ', 'Wert', 'Begründung'],
    zeilen: invarianten.map((i) => [
      latexEscape(i.id), latexEscape(i.kurztext), latexEscape(i.kette),
      latexEscape(i.typ), `${i.wert}`, latexEscape(i.begruendung),
    ]),
    beschriftung: 'Toleranzen je Invariante. Dieselbe Datei ist im Test wirksam und hier '
      + 'abgedruckt; eine zweite, im Code versteckte Toleranz existiert nicht (E-17).',
    label: 'tab:a5_toleranzen',
  });
}
