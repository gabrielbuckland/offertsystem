/**
 * Erzeugt die Negativfixtures der Konfigurationsvalidierung aus der
 * ausgelieferten Standardkonfiguration. Jede Variante traegt genau eine
 * Mutation, damit der Unterschied zwischen gueltig und ungueltig im Diff
 * ablesbar bleibt.
 *
 * Aufruf: node --experimental-strip-types tools/gen-config-invalid.ts
 *
 * Der Typ der Mutation wird REIN TYPSEITIG aus dem Kern bezogen. Ein
 * `import type` wird vom Type-Stripping restlos entfernt und loest zur Laufzeit
 * keine Modulaufloesung aus; die Kette der NodeNext-`.js`-Spezifizierer im Kern
 * ist damit hier ohne Belang.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CfgFehlerCode, RohKonfiguration } from '../packages/core/src/index.ts';

const QUELLE = 'config/company-defaults.json';
const ZIEL = 'packages/core/test/fixtures/config-invalid';

export interface NegativEintrag {
  readonly datei: string;
  /**
   * Als `CfgFehlerCode` getypt, nicht als `string`: Ein Tippfehler im erwarteten
   * Code waere sonst erst im Auswertungslauf als Fehlschlag sichtbar — und dort
   * nicht von einem echten Validierungsmangel zu unterscheiden.
   */
  readonly code: CfgFehlerCode;
  readonly verletzung: string;
  readonly mutation: (konfiguration: RohKonfiguration) => void;
}

export interface AusschlussEintrag {
  readonly fall: string;
  readonly begruendung: string;
}

export const NEGATIVMATRIX: readonly NegativEintrag[] = [
  {
    datei: 'alpha-out-of-range.json',
    code: 'CFG_ALPHA_RANGE',
    verletzung: 'alpha = 1.4 liegt ausserhalb [0, 1] (I-04)',
    mutation: (k) => { k.flaeche.alpha = 1.4; },
  },
  {
    datei: 'weights-sum-not-one.json',
    code: 'CFG_WEIGHTS_SUM',
    verletzung: 'Summe der Gewichte = 0.94 statt 1 (I-12)',
    mutation: (k) => { k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.34; },
  },
  {
    datei: 'weight-negative.json',
    code: 'CFG_WEIGHT_RANGE',
    verletzung: 'ein Gewicht ist negativ (I-12)',
    mutation: (k) => { k.aufwandfaktoren['preissegment']!.gewicht = -0.05; },
  },
  {
    datei: 'g-range-invalid.json',
    code: 'CFG_G_RANGE',
    verletzung: 'gMin = 0 verletzt 0 < gMin <= 1 (I-16, deckt zugleich I-15)',
    mutation: (k) => { k.honorar.skalierung.gMin = 0; },
  },
  {
    datei: 'stufen-nicht-aufsteigend.json',
    code: 'CFG_TIER_ORDER',
    verletzung: 'Stuetzstellenliste nicht streng aufsteigend in v (I-20)',
    mutation: (k) => { k.honorar.stuetzstellen[4]!.v = 2000000000; },
  },
  {
    datei: 'degression-stufe-verletzt.json',
    code: 'CFG_TIER_DEGRESSION',
    verletzung: 'Grenzsatz erreicht den Durchschnittssatz in Stufe 1 (I-19)',
    mutation: (k) => { k.honorar.stuetzstellen[1]!.hMax = 5000000; },
  },
  {
    datei: 'netto-degression-verletzt.json',
    code: 'CFG_NET_DEGRESSION',
    verletzung: 'starker Wirkpfad des Projektumfangs bei weitem g-Bildbereich kippt eq:netto_degression (I-18)',
    mutation: (k) => {
      // Zugriff ueber die FAKTORschluessel; `projektumfang` heisst weiterhin so (PE-03).
      k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.2;
      k.aufwandfaktoren['innenausbau_qualitaet']!.gewicht = 0.1;
      k.aufwandfaktoren['preissegment']!.gewicht = 0.1;
      k.aufwandfaktoren['projektumfang']!.gewicht = 0.6;
      k.honorar.skalierung.gMin = 0.5;
      k.honorar.skalierung.gMax = 2.5;
    },
  },
  {
    datei: 'norm-bounds-equal.json',
    code: 'CFG_NORM_BOUNDS',
    verletzung: 'min = max fuer einen Faktor; Division durch null in eq:normalisierung (I-10/I-11)',
    mutation: (k) => { k.aufwandfaktoren['innenausbau_qualitaet']!.max = 1; },
  },
  {
    datei: 'zuschlag-bounds-invalid.json',
    code: 'CFG_ADJUSTMENT_BOUNDS',
    verletzung: 'zMin = -1 verletzt z_j > -1 (I-06/I-07)',
    mutation: (k) => { k.preisanpassung.zMin = -1; },
  },
];

export const KONSTRUKTIV_AUSGESCHLOSSEN: readonly AusschlussEintrag[] = [
  {
    fall: 'Stufenluecke (V_{k+1}^min > V_k^max)',
    begruendung: 'Die Stufen entstehen als Intervalle zwischen aufeinanderfolgenden Stuetzstellen; '
      + 'eine Luecke liesse sich nur bei getrennt konfigurierten Intervallgrenzen ausdruecken.',
  },
  {
    fall: 'Stufenueberlappung (V_{k+1}^min < V_k^max)',
    begruendung: 'Gleiche Begruendung; die Liste hat je Grenze genau einen Wert.',
  },
  {
    fall: 'fallendes g',
    begruendung: 'g ist linear mit gMin <= 1 <= gMax; die Ordnung wird bereits auf Ebene 2 '
      + '(CFG_G_RANGE) und Ebene 3 (CFG_G_ORDER) erzwungen.',
  },
];

// Direkter Aufruf vs. Import: ueber fileURLToPath verglichen, weil der
// Repository-Pfad Leerzeichen enthalten kann und import.meta.url diese
// prozentkodiert — ein naiver Zeichenkettenvergleich schlaege dann fehl.
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const basis = JSON.parse(readFileSync(QUELLE, 'utf8')) as RohKonfiguration;
  mkdirSync(ZIEL, { recursive: true });

  for (const eintrag of NEGATIVMATRIX) {
    const variante = structuredClone(basis);
    variante.meta.beschreibung = `NEGATIVFIXTURE — ${eintrag.verletzung}. Erwarteter Code: ${eintrag.code}.`;
    eintrag.mutation(variante);
    writeFileSync(join(ZIEL, eintrag.datei), `${JSON.stringify(variante, null, 2)}\n`, 'utf8');
  }

  const zeilen = [
    '# Negativmatrix der Konfigurationsvalidierung',
    '',
    'Erzeugt mit `node --experimental-strip-types tools/gen-config-invalid.ts` aus `config/company-defaults.json`.',
    'Jede Variante traegt genau eine Mutation.',
    '',
    '| Datei | Verletzung | Erwarteter Code |',
    '|---|---|---|',
    ...NEGATIVMATRIX.map((e) => `| \`${e.datei}\` | ${e.verletzung} | \`${e.code}\` |`),
    '',
    '## Konstruktiv ausgeschlossen',
    '',
    'Fuer diese Faelle darf keine Fixture verlangt werden, weil das Schema sie nicht',
    'ausdruecken kann. Sie werden mit Status `konstruktiv_ausgeschlossen` gefuehrt,',
    'statt zu fehlen.',
    '',
    '| Fall | Begruendung |',
    '|---|---|',
    ...KONSTRUKTIV_AUSGESCHLOSSEN.map((e) => `| ${e.fall} | ${e.begruendung} |`),
    '',
  ];
  writeFileSync(join(ZIEL, 'negativmatrix.md'), `${zeilen.join('\n')}\n`, 'utf8');

  console.log(`${NEGATIVMATRIX.length} Negativfixtures und die Negativmatrix nach ${ZIEL} geschrieben.`);
}
