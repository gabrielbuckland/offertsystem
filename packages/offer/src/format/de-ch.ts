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
 * Notation und Rundung setzt ausschliesslich `Intl.NumberFormat('de-CH')`. Eine eigene
 * Ersetzung im fertigen String waere der Weg, die Schweizer Notation an einer Stelle zu
 * verlieren, ohne dass ein Test es merkt.
 *
 * EINE Ausnahme, und zwar auf Teile-Ebene statt im String: die Tausendertrennung. ICU
 * liefert fuer `de-CH` je nach Laufzeit ein anderes Zeichen — Node 22 setzt U+2019
 * (rechtes Anfuehrungszeichen), Chromium 151 den ASCII-Apostroph U+0027. Dieselbe
 * Funktion laeuft aber auf BEIDEN Seiten: serverseitig fuer den Druck und die erste
 * Auslieferung, im Browser fuer die Weiterverwendung in den Client-Komponenten
 * (`Aggregatleiste`, `EinheitenTabelle`, `Referenzobjekte`). Ungebunden hiesse das: eine
 * Hydratationsabweichung bei jedem Seitenaufbau und — schwerer — derselbe Betrag mit
 * einem anderen Tausenderzeichen auf dem Bildschirm als im PDF, waehrend der Bericht
 * einheitliche Schweizer Notation behauptet (NFA-13, P-06).
 *
 * Festgenagelt wird deshalb ueber `formatToParts`: getauscht wird gezielt das Teilstueck
 * vom Typ `group`, nicht ein Zeichen irgendwo im Text. Rundung, Dezimaltrennung,
 * Waehrungskuerzel und Vorzeichen bleiben unangetastet bei ICU.
 */

/** Rappen -> Franken; einzige Umrechnungsstelle des Systems (Brief §5.3). */
function zuFranken(rappen: number): number {
  return rappen / 100;
}

/**
 * U+2019, die Tausendertrennung der Schweizer Notation und die Ausgabe, gegen die die
 * Erwartungswerte dieses Pakets seit jeher geschrieben sind (`de-ch.test.ts`).
 */
const TAUSENDERTRENNUNG = '\u2019';

/**
 * Setzt die Tausendertrennung fest und laesst alles andere, wie ICU es geliefert hat.
 *
 * Als eigene, exportierte Funktion, damit die Festlegung ohne zweite Laufzeit pruefbar
 * ist: Der Test reicht Teile mit einer abweichenden Trennung herein und erwartet die
 * feste zurueck.
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

const ZIMMER = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
});

const SCORE = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 3 });

const DATUM = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' });

export const formatiereAggregat = (rappen: number): string => formatiere(AGGREGAT, zuFranken(rappen));
export const formatiereBetrag = (rappen: number): string => formatiere(EINZELPREIS, zuFranken(rappen));
export const formatiereFlaeche = (m2: number): string => `${formatiere(FLAECHE, m2)} m²`;
export const formatiereProzent = (faktor: number): string => formatiere(PROZENT, faktor);
export const formatiereZimmerzahl = (z: number): string => formatiere(ZIMMER, z);
export const formatiereScore = (s: number): string => formatiere(SCORE, s);
export const formatiereDatum = (iso: string): string => DATUM.format(new Date(iso));
