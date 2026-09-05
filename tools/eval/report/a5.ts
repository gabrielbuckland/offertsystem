/**
 * Keine Modellformel. Erzeugt die LaTeX-Fragmente des Anhangs A5.
 *
 * Der Generator liest AUSSCHLIESSLICH Artefakte. Handarbeit bleibt allein fuer die
 * einordnenden Saetze; kein Zahlenwert gelangt von Hand in den Bericht.
 *
 * Fehlende Testmetadaten erscheinen sichtbar als «METADATEN FEHLEN» — ein leeres Feld
 * saehe aus wie eine Angabe und waere schlimmer als eine sichtbare Luecke.
 */
import { hinweiskopf, latexEscape, tabelle, zahlDeCh } from './latex.ts';
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
 * ueberrepraesentieren und hat im Kern 2,25 Prozentpunkte zu viel ausgewiesen (F-060).
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
    const zges = zeilenGesamt(coverage, z.paket);
    return [
      latexEscape(z.anzeige),
      zges === null ? '--' : `${zges}`,
      l === null ? '--' : zahlDeCh(l, 2),
      b === null ? '--' : zahlDeCh(b, 2),
      z.zeilen === null ? 'kein Zeilenziel' : `$\\geq ${z.zeilen}\\,\\%$`,
      z.branches === null ? '--' : `$\\geq ${z.branches}\\,\\%$`,
    ];
  });
  const gesamt = coverage['total'];
  zeilen.push([
    '\\textbf{Total}',
    gesamt?.lines?.total === undefined ? '--' : `${gesamt.lines.total}`,
    gesamt?.lines?.pct === undefined ? '--' : zahlDeCh(gesamt.lines.pct, 2),
    gesamt?.branches?.pct === undefined ? '--' : zahlDeCh(gesamt.branches.pct, 2),
    '--', '--',
  ]);

  return hinweiskopf('artifacts/coverage/coverage-summary.json') + tabelle({
    spalten: ['>{\\raggedright\\arraybackslash}X', 'r', 'r', 'r', 'l', 'l'],
    kopf: ['Bereich', 'Zeilen', 'Zeilen \\%', 'Branches \\%', 'Ziel Zeilen', 'Ziel Branches'],
    zeilen,
    beschriftung: 'Umfang und Testabdeckung je Paket, zeilengewichtet aggregiert '
      + '(abgedeckte durch gesamte Zeilen bzw. Zweige aller Dateien des Pakets); Spalte '
      + 'Zeilen zaehlt die instrumentierten Quellcodezeilen. Die Zielwerte sind eine '
      + 'eigene Festlegung der Umsetzung. Die Abdeckung ist ein notwendiges, kein '
      + 'hinreichendes Kriterium.',
    label: 'tab:a5_coverage',
    zeilentrenner: true,
  });
}

function zeilenGesamt(coverage: CoverageArtefakt, praefix: string): number | null {
  let total = 0;
  let gefunden = false;
  for (const [pfad, eintrag] of Object.entries(coverage)) {
    if (pfad === 'total' || !pfad.includes(praefix)) continue;
    gefunden = true;
    total += eintrag.lines?.total ?? 0;
  }
  return gefunden ? total : null;
}

const KATEGORIEN: readonly (readonly [string, string, string])[] = [
  ['packages/core/test/unit/', 'Unit-Tests des Berechnungskerns',
   'Pipeline-Stufen einzeln gegen die Modellformeln, Grenzfälle der Wertebereiche'],
  ['packages/core/test/property/', 'Property-Tests',
   'Modellinvarianten über zufällig erzeugten Eingaben'],
  ['packages/core/test/config/', 'Konfigurationsprüfung',
   'Schema, Wertebereiche und fachliche Invarianten beim Laden; Negativ- und Variantenkonfigurationen'],
  ['packages/core/test/arch/', 'Architekturtests',
   'Abhängigkeitsrichtung und Determinismus-Verbote des Kerns'],
  ['packages/pricehubble/', 'Adapter- und Integrationstests',
   'Fehlerverhalten, Wiederholungs- und Zustandslogik des ACL gegen den Mock auf HTTP-Ebene'],
  ['packages/offer/', 'Offert-Tests',
   'Render- und Drucktests, Herkunftsführung, Formatierung'],
  ['apps/web/', 'Oberflächen-Logiktests',
   'Erfassungs-, Zustands- und Übersteuerungslogik, API-Routen'],
  ['tools/', 'Werkzeugtests',
   'Auswertungs- und Erzeugungswerkzeuge der Evaluation'],
] as const;

export function a5Uebersicht(tests: TestArtefakt, contractTests: number | null): string {
  const zaehler = new Map<string, number>();
  let uebrige = 0;
  for (const f of tests.faelle) {
    const kat = KATEGORIEN.find(([praefix]) => f.datei.startsWith(praefix));
    if (kat === undefined) uebrige += 1;
    else zaehler.set(kat[0], (zaehler.get(kat[0]) ?? 0) + 1);
  }
  const zeilen = KATEGORIEN.map(([praefix, name, gegenstand]) => [
    latexEscape(name), `${zaehler.get(praefix) ?? 0}`, latexEscape(gegenstand),
  ]);
  zeilen.splice(4, 0, [
    'Contract Tests', contractTests === null ? '--' : `${contractTests}`,
    latexEscape('Antwortschemata des Bewertungsdienstes gegen den Vertrag des ACL (eigener Testlauf)'),
  ]);
  if (uebrige > 0) zeilen.push(['Übrige', `${uebrige}`, '--']);
  zeilen.push(['\\textbf{Total}', `${tests.faelle.length + (contractTests ?? 0)}`, '--']);
  return hinweiskopf('artifacts/tests (Unit- und Contract-Läufe)') + tabelle({
    spalten: ['>{\\raggedright\\arraybackslash}p{0.24\\textwidth}', 'r',
      '>{\\raggedright\\arraybackslash}X'],
    kopf: ['Kategorie', 'Tests', 'Prüfgegenstand'],
    zeilen,
    beschriftung: 'Automatisierte Tests je Kategorie mit Prüfgegenstand. Die vollständigen '
      + 'Testfälle und Protokolle entstehen reproduzierbar aus dem '
      + 'Implementierungsrepositorium.',
    label: 'tab:a5_uebersicht',
    zeilentrenner: true,
  });
}
