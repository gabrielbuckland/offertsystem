/**
 * Keine Modellformel. LaTeX-Hilfen der Anhangerzeugung.
 *
 * Grundsatz: GENERIERT, NICHT GEPFLEGT. Von Hand gepflegte Testdokumente sind nach dem
 * zweiten Testlauf veraltet, und ihre Uebereinstimmung mit dem tatsaechlichen
 * Systemverhalten ist nicht pruefbar. Jedes Fragment traegt deshalb einen Hinweiskopf.
 *
 * Die Umrechnung Rappen -> Franken geschieht erst hier, an der Darstellungsgrenze.
 */

/**
 * Platzhalter fuer den Rueckstrich waehrend der Maskierung. Er muss vor allen anderen
 * Ersetzungen gesetzt und zuletzt aufgeloest werden, sonst maskierte die Funktion die
 * Rueckstriche ihrer eigenen Ersatztexte gleich mit.
 */
const PLATZHALTER = '\u0000';

const ERSETZUNGEN: readonly (readonly [RegExp, string])[] = [
  [/\\/g, PLATZHALTER],
  [/&/g, '\\&'],
  [/%/g, '\\%'],
  [/\$/g, '\\$'],
  [/#/g, '\\#'],
  [/_/g, '\\_'],
  [/\{/g, '\\{'],
  [/\}/g, '\\}'],
  [/~/g, '\\textasciitilde{}'],
  [/\^/g, '\\textasciicircum{}'],
  [new RegExp(PLATZHALTER, 'g'), '\\textbackslash{}'],
];

export function latexEscape(text: string): string {
  return ERSETZUNGEN.reduce((s, [muster, ersatz]) => s.replace(muster, ersatz), text);
}

/** Schweizer Notation mit Hochkomma als Tausendertrenner. */
export function zahlDeCh(wert: number, stellen: number): string {
  const fest = Math.abs(wert).toFixed(stellen);
  const [ganz, bruch] = fest.split('.');
  const gruppiert = (ganz ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const vorzeichen = wert < 0 ? '-' : '';
  return bruch === undefined
    ? `${vorzeichen}${gruppiert}`
    : `${vorzeichen}${gruppiert}.${bruch}`;
}

/** Umrechnung Rappen zu Franken erst bei der Darstellung. */
export function frankenAusRappen(rappen: number): string {
  return zahlDeCh(rappen / 100, 2);
}

export function longtable(t: {
  spalten: readonly string[];
  kopf: readonly string[];
  zeilen: readonly (readonly string[])[];
  beschriftung: string;
  label: string;
}): string {
  const kopfzeile = `${t.kopf.map((k) => `\\textbf{${k}}`).join(' & ')} \\\\`;
  return [
    `\\begin{longtable}{${t.spalten.join('')}}`,
    '\\toprule',
    kopfzeile,
    '\\midrule',
    '\\endfirsthead',
    '\\toprule',
    kopfzeile,
    '\\midrule',
    '\\endhead',
    ...t.zeilen.map((z) => `${z.join(' & ')} \\\\`),
    '\\bottomrule',
    `\\caption{${t.beschriftung}}`,
    `\\label{${t.label}}`,
    '\\end{longtable}',
    '',
  ].join('\n');
}

export function hinweiskopf(quelle: string): string {
  return [
    '% AUTOMATISCH ERZEUGT — nicht von Hand bearbeiten.',
    `% Quelle: ${quelle}`,
    '% Erzeugt von tools/eval/report; Aenderungen gehen beim naechsten Lauf verloren.',
    '',
  ].join('\n');
}
