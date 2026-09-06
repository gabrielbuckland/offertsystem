// Keine Formel. NFA-13: ICU liefert die Tausendertrennung von de-CH je nach Laufzeit
// unterschiedlich (Node 22: U+2019, Chromium 151: ASCII-Apostroph); formatToParts ersetzt
// gezielt das group-Teilstueck, damit PDF und Bildschirm nicht auseinanderdriften.

function zuFranken(rappen: number): number {
  return rappen / 100;
}

const TAUSENDERTRENNUNG = '\u2019';

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

// Eigener Formatierer statt PROZENT: PROZENT erzwingt ein Vorzeichen (Zu-/Abschlaege),
// das Honorar ist aber nie negativ.
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
export const formatiereHonorarProzent = (anteil: number): string => formatiere(HONORAR_PROZENT, anteil);
export const formatiereZimmerzahl = (z: number): string => formatiere(ZIMMER, z);
export const formatiereScore = (s: number): string => formatiere(SCORE, s);
export const formatiereDatum = (iso: string): string => DATUM.format(new Date(iso));
