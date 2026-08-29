/**
 * Keine Modellformel. Rendert die Tabellen der Platzhalter P1 bis P8 aus den Artefakten.
 *
 * Jede Funktion beginnt mit einem Hinweiskopf und nennt in der Beschriftung ihr
 * Quellartefakt. Kein Zahlenwert gelangt von Hand in den Bericht.
 */
import { frankenAusRappen, hinweiskopf, latexEscape, longtable, zahlDeCh } from './latex.ts';
import type { Testfall } from './vitest-reporter.ts';
import { gewichteteAbdeckung, type CoverageArtefakt } from './a5.ts';

function pz(wert: number | null | undefined): string {
  return wert === null || wert === undefined ? '--' : zahlDeCh(wert, 2);
}

function jaNein(wert: boolean | undefined): string {
  return wert === true ? 'ja' : 'nein';
}

// --- P7 (1): Sensitivitaet ----------------------------------------------------------

export interface OatZeile {
  readonly dimension: string;
  readonly parameter_id: string;
  readonly variation_prozent: number;
  readonly szenario_id: string;
  readonly delta_V_prozent: number | null;
  readonly delta_Hmin_prozent: number | null;
  readonly delta_Hmax_prozent: number | null;
  readonly wirkpfad: string | null;
  readonly dominant: boolean;
  readonly status: string;
}

export function p7Sensitivitaet(oat: { readonly zeilen: readonly OatZeile[] }): string {
  const zeilen = oat.zeilen.map((z) => [
    latexEscape(z.dimension),
    latexEscape(z.parameter_id),
    `${z.variation_prozent > 0 ? '+' : ''}${z.variation_prozent}`,
    latexEscape(z.szenario_id),
    pz(z.delta_V_prozent), pz(z.delta_Hmin_prozent), pz(z.delta_Hmax_prozent),
    z.status !== 'ok' ? latexEscape(z.status) : (z.dominant ? 'dominant' : '--'),
  ]);
  return hinweiskopf('artifacts/eval/oat/<zeitstempel>/oat.json') + longtable({
    spalten: ['l', 'l', 'r', 'l', 'r', 'r', 'r', 'l'],
    kopf: ['Dim.', 'Parameter', 'Var. \\%', 'Szen.',
           'Verkaufssumme \\%', '$H_{\\min}\\cdot g$ \\%', '$H_{\\max}\\cdot g$ \\%', 'Befund'],
    zeilen,
    beschriftung: 'Sensitivitätsanalyse je Variationsdimension: prozentuale Änderung von '
      + 'Verkaufssumme und Honorarrange, getrennt gemessen. Als dominant gilt eine relative '
      + 'Änderung von mehr als 10 Prozent. Dimension D3 misst mit der Korridor-Projektion '
      + 'der Szenariodaten; sie ist eine Operation des Werkzeugs, nicht der Pipeline.',
    label: 'tab:p7_sensitivitaet',
  });
}

// --- P7 (4): Marge der Netto-Degression ---------------------------------------------

export interface Aufloesungszeile {
  readonly parameter: string;
  readonly istwert: number;
  readonly zielwert: number | null;
  readonly relative_variation: number | null;
  readonly erreichbar: boolean;
  readonly unerreichbar_im_variationsbereich: boolean;
  readonly grund: string | null;
}

export interface MargenArtefakt {
  readonly margin_min: number;
  readonly margin_min_grosser_sprung?: number;
  readonly argmin: {
    readonly randkurve: string; readonly k: number;
    readonly m1: number; readonly m2: number;
  } | null;
  readonly kritischer_parameter: string | null;
  readonly benoetigte_variation: readonly Aufloesungszeile[];
}

export function p7Marge(margin: MargenArtefakt): string {
  const a = margin.argmin;
  const kopf = [
    '\\begin{description}',
    `  \\item[Kleinste Marge \\(M = R/L\\)] ${zahlDeCh(margin.margin_min, 4)} `
      + '(Bedingung erfüllt genau dann, wenn \\(M \\geq 1\\))',
    ...(margin.margin_min_grosser_sprung === undefined ? [] : [
      `  \\item[Kleinste Marge bei grossem Projektsprung (\\(\\lambda \\geq 3\\))] `
        + `${zahlDeCh(margin.margin_min_grosser_sprung, 4)}`,
    ]),
    a === null ? '  \\item[Ungültigste Konstellation] keine' :
      `  \\item[Ungültigste Konstellation] Randkurve ${latexEscape(a.randkurve)}, `
      + `Stufe ${a.k}, \\(m_1 = ${a.m1}\\), \\(m_2 = ${a.m2}\\)`,
    `  \\item[Kritischer Parameter] `
      + `${latexEscape(margin.kritischer_parameter ?? 'keiner erreichbar')}`,
    '\\end{description}',
    '',
  ].join('\n');
  const zeilen = margin.benoetigte_variation.map((v) => [
    latexEscape(v.parameter),
    zahlDeCh(v.istwert, 4),
    v.zielwert === null ? '--' : zahlDeCh(v.zielwert, 4),
    v.relative_variation === null ? '--' : `${zahlDeCh(v.relative_variation * 100, 2)}\\,\\%`,
    v.erreichbar
      ? (v.unerreichbar_im_variationsbereich
          ? 'ausserhalb $\\pm 20\\,\\%$ nicht erreichbar'
          : 'innerhalb des Variationsbereichs erreichbar')
      : latexEscape(v.grund ?? 'nicht erreichbar'),
  ]);
  return hinweiskopf('artifacts/eval/degression/<zeitstempel>/margin.json') + kopf + longtable({
    spalten: ['l', 'r', 'r', 'r', 'p{0.30\\textwidth}'],
    kopf: ['Parameter', 'Istwert', 'Wert bei $M = 1$', 'nötige Variation', 'Befund'],
    zeilen,
    beschriftung: 'Marge der Netto-Degression: Abstand zur Schranke und die je Parameter '
      + 'nötige Variation, um sie zu erreichen. Analytisch aus Stützstellen und '
      + 'Bildbereich der Skalierungsfunktion bestimmt; es wurde keine unzulässige '
      + 'Konfiguration ausgeführt. Die Aussage zu den Stützstellen ist auf die '
      + 'einparametrige Familie beschränkt, die das Grundhonorar festhält.',
    label: 'tab:p7_marge',
  });
}

// --- P3/P4: Erweiterbarkeit ---------------------------------------------------------

export interface KategorieZahlen {
  readonly dateien_geaendert: number;
  readonly dateien_neu: number;
  readonly zeilen_hinzugefuegt: number;
  readonly zeilen_entfernt: number;
  readonly dateiliste: readonly string[];
}

export interface Messfall {
  readonly messung_verweigert: boolean;
  readonly nicht_durchgefuehrt?: boolean;
  readonly zuschnitt?: {
    readonly stoerende: readonly {
      readonly hash: string; readonly betreff: string;
      readonly dateien_ausserhalb: readonly string[];
    }[];
  };
  readonly grund?: string;
  readonly metrik_1_und_2?: KategorieZahlen;
  readonly konfiguration?: KategorieZahlen;
  readonly test?: KategorieZahlen;
  readonly kern_unversehrt?: boolean;
  readonly kernstufen_pipeline_unveraendert?: boolean;
  readonly faktormenge_datengetrieben?: boolean;
  readonly zeitaufwand_min?: number | null;
}

export interface ExtensionArtefakt {
  readonly regelfall: Messfall;
  readonly sonderfall?: Messfall;
}

/** Metrikzeilen eines Messfalls (Regel- wie Sonderfall teilen die Struktur). */
function p4Zeilen(r: ExtensionArtefakt['regelfall']): string[][] {
  const code = r.metrik_1_und_2;
  return [
    ['Codedateien geändert', `${code?.dateien_geaendert ?? '--'}`, 'Metrik 1'],
    ['Codedateien neu', `${code?.dateien_neu ?? '--'}`, 'Metrik 1'],
    ['Codezeilen hinzugefügt', `${code?.zeilen_hinzugefuegt ?? '--'}`, 'Metrik 2'],
    ['Codezeilen entfernt', `${code?.zeilen_entfernt ?? '--'}`, 'Metrik 2'],
    ['Konfigurationsdateien geändert', `${r.konfiguration?.dateien_geaendert ?? '--'}`,
     'separat ausgewiesen'],
    ['Testdateien geändert', `${r.test?.dateien_geaendert ?? '--'}`, 'separat ausgewiesen'],
    ['Pipeline-Kern unversehrt', jaNein(r.kern_unversehrt), 'Metrik 3, binär'],
    ['Kernstufen der Pipeline unverändert', jaNein(r.kernstufen_pipeline_unveraendert),
     'Metrik 3'],
    ['Faktormenge datengetrieben', jaNein(r.faktormenge_datengetrieben),
     'Voraussetzung der Aussagekraft'],
    ['Zeitaufwand [min]',
     r.zeitaufwand_min === null || r.zeitaufwand_min === undefined
       ? 'nicht erfasst' : `${r.zeitaufwand_min}`,
     'manuell nachgetragen (O-04)'],
  ];
}

export function p4Erweiterung(extension: ExtensionArtefakt): string {
  const r = extension.regelfall;
  if (r.messung_verweigert) {
    const zeilen = (r.zuschnitt?.stoerende ?? []).map((s) => [
      latexEscape(s.hash.slice(0, 8)), latexEscape(s.betreff),
      latexEscape(s.dateien_ausserhalb.join(', ')),
    ]);
    return `${hinweiskopf('artifacts/eval/extension/<zeitstempel>/extension.json')
      }\\textbf{Messung verweigert.} ${latexEscape(r.grund ?? '')}\n\n${longtable({
        spalten: ['l', 'p{0.34\\textwidth}', 'p{0.40\\textwidth}'],
        kopf: ['Commit', 'Betreff', 'Dateien ausserhalb des Scopes'],
        zeilen,
        beschriftung: 'Störende Commits, die eine aussagekräftige Messung verhindern.',
        label: 'tab:p4_erweiterung_verweigert',
      })}`;
  }
  const regelfallTabelle = longtable({
    spalten: ['p{0.42\\textwidth}', 'r', 'p{0.34\\textwidth}'],
    kopf: ['Messgrösse', 'Wert', 'Bemerkung'],
    zeilen: p4Zeilen(r),
    beschriftung: 'Erweiterungsaufwand im Regelfall (neuer Aufwandfaktor), aus der '
      + 'Versionsgeschichte zwischen den Tags \\texttt{eval/ff1b-vorher} und '
      + '\\texttt{eval/ff1b-nachher} erhoben. Code, Konfiguration und Testdateien '
      + 'werden getrennt ausgewiesen, weil die Null-Dateien-Messlatte sich allein '
      + 'auf Codedateien bezieht.',
    label: 'tab:p4_erweiterung',
  });

  const s = extension.sonderfall;
  let sonderfallTabelle = '';
  if (s !== undefined && s.nicht_durchgefuehrt !== true
      && s.messung_verweigert !== true) {
    sonderfallTabelle = longtable({
      spalten: ['p{0.42\\textwidth}', 'r', 'p{0.34\\textwidth}'],
      kopf: ['Messgrösse', 'Wert', 'Bemerkung'],
      zeilen: p4Zeilen(s),
      beschriftung: 'Erweiterungsaufwand im Sonderfall (neue '
        + 'Normalisierungsstrategie), erhoben zwischen den Tags '
        + '\\texttt{eval/ff1b-strategie-vorher} und '
        + '\\texttt{eval/ff1b-strategie-nachher}. Hier ist eine lokalisierte '
        + 'Codeänderung erwartet; die Messlatte ist, dass sämtliche geänderten '
        + 'und neuen Codedateien im Strategieverzeichnis liegen und die '
        + 'Kernstufen der Pipeline unverändert bleiben.',
      label: 'tab:p4_sonderfall',
    });
  }
  return hinweiskopf('artifacts/eval/extension/<zeitstempel>/extension.json')
    + regelfallTabelle + sonderfallTabelle;
}

// --- P1: Szenarien ------------------------------------------------------------------

export interface SzenarienArtefakt {
  readonly schwelle: number;
  readonly gesamt: string;
  readonly szenarien: readonly {
    readonly id: string;
    readonly bestanden: boolean;
    readonly referenz: { verkaufssumme: number; honorarMin: number; honorarMax: number };
    readonly ist: { verkaufssumme: number; honorarMin: number; honorarMax: number };
    readonly abweichung: { verkaufssumme: number; honorarMin: number; honorarMax: number };
    readonly stufendiagnose?: Readonly<Record<string, number>>;
    readonly lagedatenHerkunft?: string;
  }[];
}

export function p1Szenarien(
  szenarien: SzenarienArtefakt,
  herkunft: Readonly<Record<string, string>> = {},
): string {
  const zeilen = szenarien.szenarien.map((s) => [
    latexEscape(s.id),
    frankenAusRappen(s.referenz.verkaufssumme),
    frankenAusRappen(s.ist.verkaufssumme),
    `${zahlDeCh(s.abweichung.verkaufssumme * 100, 2)}\\,\\%`,
    `${zahlDeCh(s.abweichung.honorarMin * 100, 2)}\\,\\%`,
    `${zahlDeCh(s.abweichung.honorarMax * 100, 2)}\\,\\%`,
    s.bestanden ? 'bestanden' : 'nicht bestanden',
    s.stufendiagnose === undefined
      ? '--'
      : latexEscape(Object.entries(s.stufendiagnose).map(([k, v]) => `${k}=${v}`).join('; ')),
    latexEscape(s.lagedatenHerkunft ?? herkunft[s.id] ?? '--'),
  ]);
  return hinweiskopf('artifacts/scenarios/<zeitstempel>/szenarien.json') + longtable({
    spalten: ['l', 'r', 'r', 'r', 'r', 'r', 'l', 'p{0.16\\textwidth}', 'l'],
    kopf: ['Szen.', 'Referenz $V$ [CHF]', 'Ist $V$ [CHF]', '$\\Delta V$',
           '$\\Delta H_{\\min}$', '$\\Delta H_{\\max}$', 'Bewertung', 'Stufendiagnose',
           'Lagedaten'],
    zeilen,
    beschriftung: `Szenarienlauf gegen die unabhängige Referenzrechnung; bestanden gilt `
      + `bei einer Abweichung bis ${zahlDeCh(szenarien.schwelle * 100, 0)} Prozent. `
      + 'Die Spalte Lagedaten weist die Herkunft der Lagescores aus (R-01).',
    label: 'tab:p1_szenarien',
  });
}

// --- P2: Stufen, Invarianten, Konfigurationspruefung --------------------------------

export function p2Stufen(
  tests: { readonly faelle: readonly Testfall[] },
  coverage: CoverageArtefakt,
): string {
  const stufen = [
    ['Stufe 1 — Eingabe', 'stufe1'],
    ['Stufe 2 — Verkaufssumme', 'stufe2'],
    ['Stufe 2a — abgeleitete Faktoren', 'stufe2a'],
    ['Stufe 3 — Normalisierung', 'stufe3'],
    ['Stufe 4 — Gewichtung', 'stufe4'],
    ['Stufe 5 — Honorar', 'stufe5'],
  ] as const;
  const zeilen = stufen.map(([anzeige, muster]) => {
    const passend = tests.faelle.filter(
      (f) => f.datei.includes(muster) || (f.suite ?? '').toLowerCase().includes(muster));
    const abdeckung = gewichteteAbdeckung(coverage, muster, 'lines');
    return [
      latexEscape(anzeige),
      `${passend.length}`,
      abdeckung === null ? '--' : zahlDeCh(abdeckung, 2),
      passend.every((f) => f.zustand !== 'fail') ? 'bestanden' : 'nicht bestanden',
    ];
  });
  return hinweiskopf('artifacts/tests + artifacts/coverage') + longtable({
    spalten: ['p{0.36\\textwidth}', 'r', 'r', 'l'],
    kopf: ['Pipeline-Stufe', 'Testfälle', 'Zeilenabdeckung \\%', 'Ergebnis'],
    zeilen,
    beschriftung: 'Testergebnisse je Pipeline-Stufe mit Zeilenabdeckung. Die Zuordnung '
      + 'erfolgt über den Dateinamen der Testdatei; Fälle ohne Stufenbezug erscheinen '
      + 'nicht in dieser Tabelle.',
    label: 'tab:p2_stufen',
  });
}

export interface PropertyArtefakt {
  readonly seed: number | null;
  readonly numRuns?: number;
  readonly properties: readonly {
    readonly id: string; readonly runs?: number;
    readonly pass?: boolean; readonly gegenbeispiel?: string | null;
  }[];
}

export function p2Invarianten(properties: PropertyArtefakt): string {
  const zeilen = properties.properties.map((p) => [
    latexEscape(p.id),
    `${p.runs ?? properties.numRuns ?? '--'}`,
    p.pass === false ? 'nicht bestanden' : 'bestanden',
    p.gegenbeispiel === null || p.gegenbeispiel === undefined
      ? '--' : latexEscape(p.gegenbeispiel),
  ]);
  return hinweiskopf('artifacts/property/<zeitstempel>/properties.json') + longtable({
    spalten: ['l', 'r', 'l', 'p{0.40\\textwidth}'],
    kopf: ['Invariante', 'Läufe', 'Ergebnis', 'minimiertes Gegenbeispiel'],
    zeilen,
    beschriftung: `Invariantenprüfung mit fast-check, Startwert ${properties.seed ?? '--'}. `
      + 'Jeder Befund ist mit diesem Startwert exakt wiederholbar.',
    label: 'tab:p2_invarianten',
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

export function p2Konfigpruefung(config: KonfigArtefakt): string {
  const positiv = Object.entries(config.positivlauf).map(([k, v]) => [
    latexEscape(k),
    latexEscape(typeof v === 'object' ? JSON.stringify(v) : String(v)),
  ]);
  const negativ = config.negativmatrix.map((n) => [
    latexEscape(n.datei), latexEscape(n.verletzung), latexEscape(n.erwarteterCode),
    latexEscape(n.tatsaechlicheCodes.join(', ')),
    n.ergebnisObjektErzeugt ? 'ja' : 'nein', latexEscape(n.status),
  ]);
  const ausgeschlossen = config.konstruktivAusgeschlossen.map((k) => [
    latexEscape(k.fall), latexEscape(k.begruendung), latexEscape(k.status),
  ]);
  return hinweiskopf('artifacts/config/<zeitstempel>/config-validation.json')
    + longtable({
        spalten: ['l', 'p{0.60\\textwidth}'],
        kopf: ['Grösse', 'Wert im Positivlauf'],
        zeilen: positiv,
        beschriftung: `Positivlauf der Konfigurationsprüfung, Version `
          + `${latexEscape(config.konfigVersion)}: die drei Prüfebenen mit ihren Zahlenwerten. `
          + `Die Grösse \\code{kleinsteMarge} im Befund \\code{nettoDegression} ist die `
          + `relative Sicherheitsmarge $1 - \\text{Verhältnis}/\\text{Schwelle}$ der `
          + `Vorprüfung (erfüllt bei Werten über null); sie ist nicht die Marge `
          + `$M = R/L$ aus Tabelle~\\ref{tab:p7_marge}.`,
        label: 'tab:p2_konfig_positiv',
      })
    + longtable({
        spalten: ['p{0.22\\textwidth}', 'p{0.22\\textwidth}', 'l', 'l', 'l', 'l'],
        kopf: ['Fixture', 'Verletzung', 'erwartet', 'tatsächlich', 'Ergebnis erzeugt', 'Status'],
        zeilen: negativ,
        beschriftung: 'Negativmatrix: je verletzender Konfiguration der erwartete und der '
          + 'tatsächliche CFG-Code. Kein Fall erzeugt ein Ergebnisobjekt (I-21).',
        label: 'tab:p2_konfig_negativ',
      })
    + longtable({
        spalten: ['p{0.24\\textwidth}', 'p{0.52\\textwidth}', 'l'],
        kopf: ['Fall', 'Begründung', 'Status'],
        zeilen: ausgeschlossen,
        beschriftung: 'Konstruktiv ausgeschlossene Fälle: Sie sind nicht darstellbar und '
          + 'werden deshalb nicht geprüft, sondern begründet ausgewiesen (E-18).',
        label: 'tab:p2_konfig_ausgeschlossen',
      });
}

// --- P5/P6: Integration und Entkopplung ---------------------------------------------

export interface KategorieZeile {
  readonly szenario?: string;
  readonly kategorie?: string;
  readonly fall?: string;
  readonly erwarteterStatus?: string;
  readonly beobachteterStatus?: string;
  readonly pipelineZustand?: string;
}

export interface LaufArtefakt {
  readonly systemverhalten?: string;
  readonly fehlerstatus?: string;
  readonly pipelineZustand?: string;
  readonly ergebnis?: string;
  readonly anzahlTests?: number;
  readonly laufzeitMs?: number;
  readonly wirkung?: string;
  readonly fixtures_herkunft?: string;
  readonly kategorien?: readonly KategorieZeile[];
}

export function p5Integration(integration: LaufArtefakt): string {
  const kategorien = integration.kategorien ?? [];
  if (kategorien.length === 0) {
    throw new Error(
      'Integrations-Artefakt ohne kategorien: Der Nachweis je Fehlerkategorie '
      + '(sec:integrationstests) braucht eine Zeile je gefahrener Kategorie. '
      + 'Testlauf mit aktuellem ff2-szenarien.test.ts wiederholen.',
    );
  }
  const zeilen = kategorien.map((k) => [
    latexEscape((k.szenario ?? '--').split(' ')[0] ?? '--'),
    latexEscape(k.kategorie ?? '--'),
    latexEscape(k.fall ?? '--'),
    latexEscape(k.erwarteterStatus ?? '--'),
    latexEscape(k.beobachteterStatus ?? '--'),
    latexEscape(k.pipelineZustand ?? '--'),
  ]);
  return hinweiskopf('artifacts/integration/<zeitstempel>/integration.json') + longtable({
    spalten: ['l', 'p{0.15\\textwidth}', 'p{0.20\\textwidth}', 'p{0.13\\textwidth}',
              'p{0.13\\textwidth}', 'p{0.11\\textwidth}'],
    kopf: ['Szen.', 'Kategorie', 'Fall', 'Erwarteter Status', 'Beobachteter Status',
           'Pipeline'],
    zeilen,
    beschriftung: 'Integrationslauf gegen die Mock-API: erwarteter und beobachteter '
      + 'Fehlerstatus sowie Zustand der Pipeline je gefahrenem Fall; die '
      + 'Kategoriespalte ordnet jeden Fall einer der vier Fehlerkategorien aus '
      + `Tabelle~\\ref{tab:fehler_abbildung} zu. Gesamtergebnis `
      + `${latexEscape(integration.ergebnis ?? '--')} `
      + `(${integration.anzahlTests ?? '--'} Tests, `
      + `${integration.laufzeitMs ?? '--'}\\,ms).`,
    label: 'tab:p5_integration',
  });
}

export function p6Entkopplung(integration: LaufArtefakt, contract: LaufArtefakt): string {
  const zeilen = [
    ['Tests gesamt (Integration)', `${integration.anzahlTests ?? '--'}`],
    ['Laufzeit gesamt [ms]', `${integration.laufzeitMs ?? '--'}`],
    ['Reale API-Zugriffe', '0'],
    ['Contract Tests', `${contract.anzahlTests ?? '--'}`],
    ['Wirkung der Contract Tests', latexEscape(contract.wirkung ?? '--')],
    ['Herkunft der Fixtures', latexEscape(contract.fixtures_herkunft ?? '--')],
  ];
  return hinweiskopf('artifacts/integration + artifacts/contract') + longtable({
    spalten: ['l', 'p{0.50\\textwidth}'],
    kopf: ['Kriterium', 'Wert'],
    zeilen,
    beschriftung: 'Nachweis der Entkopplung: Der vollständige Testlauf kommt ohne '
      + 'API-Zugang aus. Die Contract Tests wirken detektiv; ihre Aussagekraft hängt an '
      + 'der Herkunft der Fixtures.',
    label: 'tab:p6_entkopplung',
  });
}

// --- P8: manuelle Pruefpunkte -------------------------------------------------------

export interface ManuellArtefakt {
  readonly punkte?: readonly {
    readonly punkt: string; readonly ergebnis: string; readonly datum?: string;
    readonly pruefer?: string; readonly anforderung?: string | null;
  }[];
}

export function p8Pruefpunkte(manual: ManuellArtefakt | null): string {
  if (manual === null || manual.punkte === undefined || manual.punkte.length === 0) {
    return `${hinweiskopf('artifacts/manual/<datum>/ui.json')
      }Die manuelle Prüfung der Oberfläche ist noch nicht durchgeführt. Die vorab `
      + `festgelegte Prüfpunktliste liegt unter \\texttt{docs/testdoku/manual/`
      + `ui-testfaelle.md}; sie ist bewusst vor der Durchführung fixiert.\n\n`;
  }
  const zeilen = manual.punkte.map((p) => [
    latexEscape(p.punkt), latexEscape(p.ergebnis), latexEscape(p.datum ?? '--'),
    latexEscape(p.pruefer ?? '--'), latexEscape(p.anforderung ?? '--'),
  ]);
  return hinweiskopf('artifacts/manual/<datum>/ui.json') + longtable({
    spalten: ['l', 'l', 'l', 'l', 'l'],
    kopf: ['Prüfpunkt', 'Ergebnis', 'Datum', 'Prüfer', 'Anforderung'],
    zeilen,
    beschriftung: 'Manuelle Prüfpunkte der Oberfläche. Die Dashboard-Punkte tragen die '
      + 'Anforderung A-12 und sind damit gesondert auswertbar (E-30).',
    label: 'tab:p8_pruefpunkte',
  });
}
