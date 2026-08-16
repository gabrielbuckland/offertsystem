/**
 * Keine Formel. Formatierung an der Darstellungsgrenze (NFA-13, Brief §5.3).
 *
 * Die einzige Arithmetik dieses Pakets steht hier: die Division Rappen -> Franken.
 * Sie ist keine Rechenstufe, sondern eine Einheitenumrechnung — die Rechenkette
 * fuehrt durchgehend ganzzahlige Rappen, damit keine Gleitkommadrift entsteht.
 *
 * Es gibt keine Umkehrfunktion. Ein formatierter Wert fliesst nie zurueck; gespeicherte
 * Artefakte enthalten unformatierte Zahlen. Eine Rueckparsierung waere ein zweiter,
 * stiller Konvertierungspfad mit eigener Fehlerquelle.
 *
 * Trennzeichen setzt ausschliesslich `Intl.NumberFormat('de-CH')`. Eine eigene
 * Ersetzung im String waere der Weg, die Schweizer Notation an einer Stelle zu
 * verlieren, ohne dass ein Test es merkt.
 */

/** Rappen -> Franken; einzige Umrechnungsstelle des Systems (Brief §5.3). */
function zuFranken(rappen: number): number {
  return rappen / 100;
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

const ZIMMER = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
});

const SCORE = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 3 });

const DATUM = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' });

export const formatiereAggregat = (rappen: number): string => AGGREGAT.format(zuFranken(rappen));
export const formatiereBetrag = (rappen: number): string => EINZELPREIS.format(zuFranken(rappen));
export const formatiereFlaeche = (m2: number): string => `${FLAECHE.format(m2)} m²`;
export const formatiereProzent = (faktor: number): string => PROZENT.format(faktor);
export const formatiereZimmerzahl = (z: number): string => ZIMMER.format(z);
export const formatiereScore = (s: number): string => SCORE.format(s);
export const formatiereDatum = (iso: string): string => DATUM.format(new Date(iso));
