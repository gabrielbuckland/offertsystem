/**
 * Auswertung von eq:honorar_mapping als Kurve des Honoraranteils phi(V) = H(V)/V.
 *
 * Absolute Honorarbetraege ueber V waeren aussagelos, weil sie ohnehin steigen. Die
 * Degression steckt im Anteil an der Verkaufssumme; die Ordinate ist deshalb ein
 * Prozentwert.
 *
 * V = 0 ist eine Stuetzstelle des Modells, aber kein Punkt dieser Kurve: Dort steht ein
 * Grundhonorar groesser null, phi(0) ist damit nicht definiert und phi(V) waechst fuer V
 * gegen 0 ueber jede Schranke. Die Abtastung beginnt darum bei der ersten Stuetzstelle mit
 * V > 0 und endet bei der letzten; extrapoliert wird nach E-04 nirgends.
 *
 * Gerechnet wird ueber `honorarbasis`/`durchschnittssatz` aus dem Margen-Werkzeug — die
 * Formel wird nicht ein drittes Mal implementiert.
 */
import { durchschnittssatz, type Stuetzstelle } from '../degression-margin/honorarkurve.ts';

export interface Kurvenpunkt {
  readonly v_rappen: number;
  readonly hMin_prozent: number;
  readonly hMax_prozent: number;
}

/**
 * Je Stufe `jeStufe` geometrisch verteilte Punkte einschliesslich beider Stufengrenzen.
 * Die Grenzen sind exakte Abtastpunkte, damit die Knicke der stueckweisen Interpolation
 * scharf bleiben und nicht ueber eine Stufengrenze hinweg weggemittelt werden.
 */
export function abtastpunkte(
  stuetzstellen: readonly Stuetzstelle[],
  jeStufe: number,
): readonly number[] {
  if (jeStufe < 1) throw new Error('jeStufe muss mindestens 1 sein');
  const punkte = new Set<number>();
  for (let k = 0; k < stuetzstellen.length - 1; k += 1) {
    const links = stuetzstellen[k]!.v;
    const rechts = stuetzstellen[k + 1]!.v;
    // Stufen, die bei V = 0 beginnen, tragen keinen darstellbaren Anteil (siehe Kopf).
    if (links <= 0 || rechts <= links) continue;
    punkte.add(links);
    punkte.add(rechts);
    for (let i = 1; i < jeStufe; i += 1) {
      punkte.add(Math.round(links * (rechts / links) ** (i / jeStufe)));
    }
  }
  return [...punkte].sort((a, b) => a - b);
}

export function baueKurve(
  stuetzstellen: readonly Stuetzstelle[],
  punkte: readonly number[],
): readonly Kurvenpunkt[] {
  const kurve: Kurvenpunkt[] = [];
  for (const v of punkte) {
    const min = durchschnittssatz(stuetzstellen, 'hMin', v);
    const max = durchschnittssatz(stuetzstellen, 'hMax', v);
    if (min === null || max === null) continue;
    kurve.push({ v_rappen: v, hMin_prozent: min * 100, hMax_prozent: max * 100 });
  }
  return kurve;
}

/** Die Stuetzstellen, die auf der Kurve liegen — also alle mit V > 0. */
export function darstellbareStuetzstellen(
  stuetzstellen: readonly Stuetzstelle[],
): readonly Stuetzstelle[] {
  return stuetzstellen.filter((s) => s.v > 0);
}
