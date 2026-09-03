/**
 * Keine Formel. Formatierung an der Darstellungsgrenze (NFA-13).
 *
 * Einzige Arithmetik: Division Rappen -> Franken, keine Rechenstufe sondern
 * Einheitenumrechnung. Keine Umkehrfunktion — gespeicherte Artefakte bleiben
 * unformatiert, eine Rueckparsierung waere ein zweiter, stiller Konvertierungspfad.
 *
 * ICU liefert fuer die Tausendertrennung von `de-CH` je nach Laufzeit ein anderes
 * Zeichen (Node 22: U+2019, Chromium 151: ASCII-Apostroph U+0027) — dieselbe Funktion
 * laeuft aber serverseitig (Druck) und im Browser (Client-Komponenten), sonst driften
 * PDF und Bildschirm auseinander (NFA-13). Deshalb wird ueber `formatToParts`
 * gezielt das Teilstueck vom Typ `group` getauscht statt ein Zeichen im fertigen String
 * zu ersetzen — Rundung, Dezimaltrennung, Waehrung und Vorzeichen bleiben bei ICU.
 */

/** Rappen -> Franken; einzige Umrechnungsstelle des Systems. */
function zuFranken(rappen: number): number {
  return rappen / 100;
}

/** U+2019, die Tausendertrennung der Schweizer Notation (`de-ch.test.ts`). */
const TAUSENDERTRENNUNG = '\u2019';

/**
 * Eigene, exportierte Funktion, damit die Festlegung ohne zweite Laufzeit pruefbar ist:
 * der Test reicht Teile mit abweichender Trennung herein und erwartet die feste zurueck.
 */
export function mitFesterTrennung(teile: readonly Intl.NumberFormatPart[]): string {
  return teile.map((t) => (t.type === 'group' ? TAUSENDERTRENNUNG : t.value)).join('');
}

function formatiere(formatierer: Intl.NumberFormat, wert: number): string {
  return mitFesterTrennung(formatierer.formatToParts(wert));
}

const AGGREGAT = new Intl.NumberFormat('de-CH', {
  style: 'currency', currency: 'CHF',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});

const EINZELPREIS = new Intl.NumberFormat('de-CH', {
  style: 'currency', currency: 'CHF',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const FLAECHE = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
});

const PROZENT = new Intl.NumberFormat('de-CH', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/**
 * Eigener Formatierer statt Wiederverwendung von `PROZENT`: `PROZENT`
 * traegt `signDisplay: 'exceptZero'` fuer Zu-/Abschlaege (immer mit Vorzeichen), das
 * Honorar ist aber nie negativ und ein erzwungenes "+" waere hier falsch. Beide teilen
 * dieselbe Nachkommastellen-Vorgabe (eine Stelle) und denselben ICU-Ausgabepfad
 * (`formatiere`/`mitFesterTrennung`).
 */
const HONORAR_PROZENT = new Intl.NumberFormat('de-CH', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
});

const ZIMMER = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
});

const SCORE = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 3 });

const DATUM = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' });

export const formatiereAggregat = (rappen: number): string => formatiere(AGGREGAT, zuFranken(rappen));
export const formatiereBetrag = (rappen: number): string => formatiere(EINZELPREIS, zuFranken(rappen));
export const formatiereFlaeche = (m2: number): string => `${formatiere(FLAECHE, m2)} m²`;
export const formatiereProzent = (faktor: number): string => formatiere(PROZENT, faktor);
/** Honorar/Verkaufssumme als vorzeichenlose Prozentzahl, eine Nachkommastelle. */
export const formatiereHonorarProzent = (anteil: number): string => formatiere(HONORAR_PROZENT, anteil);
export const formatiereZimmerzahl = (z: number): string => formatiere(ZIMMER, z);
export const formatiereScore = (s: number): string => formatiere(SCORE, s);
export const formatiereDatum = (iso: string): string => DATUM.format(new Date(iso));
