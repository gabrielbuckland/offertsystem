// Reine Logik rund um den gewaehlten Honorarsatz (Eingabemodal, Aggregatleiste), getrennt
// von der Darstellung fuer DOM-freie Tests.
import { rundeAufRappen } from '@offert/core';
import { berechneHonorarProzent, formatiereHonorarProzent } from '@offert/offer';

export { honorarAbweichung, type HonorarAbweichung } from '@offert/offer';

/** Die Verkaufssumme traegt die Prozentrechnung in beide Richtungen; <= 0 ist keine
 *  sinnvolle Bezugsgroesse (Division durch null), ein fehlender Wert erst recht nicht. */
function verkaufssummeTaugt(wert: number | undefined): wert is number {
  return wert !== undefined && wert > 0;
}

/**
 * Formatierte Prozentanzeige eines Rappenbetrags (Empfehlungsrange, Honorarrange in der
 * Aggregatleiste) an der Verkaufssumme. `–` statt einer kaputten Zahl, wenn die
 * Verkaufssumme fehlt oder keine sinnvolle Bezugsgroesse ist.
 */
export function formatiereHonorarAlsProzent(
  betragRappen: number, verkaufssummeRappen: number | undefined,
): string {
  if (verkaufssummeRappen === undefined) return '–';
  const anteil = berechneHonorarProzent(betragRappen, verkaufssummeRappen);
  return anteil === null ? '–' : formatiereHonorarProzent(anteil);
}

/**
 * Prozenteingabe (`3.2` fuer 3,2 %) -> Rappenbetrag. Der Vermarkter entscheidet in
 * Prozent der Verkaufssumme, das Artefakt fuehrt weiterhin einen Rappenbetrag — die
 * gesamte Preiskette, das Offertdokument und der Reproduzierbarkeitsrundlauf rechnen in
 * Rappen. Gerundet wird ueber `rundeAufRappen` (E-10), nicht ueber `Math.round`: die
 * Umrechnung ist eine Betragsableitung wie R1–R3 und muss denselben Rundungsmodus
 * benutzen. `undefined`, wenn die Eingabe leer oder nicht parsierbar ist oder die
 * Verkaufssumme als Bezugsgroesse fehlt — ohne sie gibt es keinen Betrag.
 */
export function prozentEingabeZuRappen(
  text: string, verkaufssummeRappen: number | undefined,
): number | undefined {
  if (!verkaufssummeTaugt(verkaufssummeRappen)) return undefined;
  if (text.trim() === '') return undefined;
  const prozent = Number(text);
  if (!Number.isFinite(prozent)) return undefined;
  return rundeAufRappen((verkaufssummeRappen * prozent) / 100);
}

/**
 * Sperrgrund fuers Bestaetigen, oder `undefined`, wenn ein gueltiger Betrag vorliegt.
 * Das Feld startet LEER — keine Vorbelegung mit dem Range-Mittelwert. Eine
 * Systemvorbelegung, die der Vermarkter nur noch bestaetigt, liefe als SEINE Entscheidung
 * ins Dokument (Herkunft `marketer-decision`), obwohl sie das System gesetzt hat
 * (Automation Bias). Drei Faelle statt eines generischen Textes, damit der Vermarkter
 * sieht, WARUM gesperrt ist: fehlende Bezugsgroesse (kein Prozentsatz umrechenbar),
 * nichts eingegeben, oder eine unbrauchbare Eingabe (z. B. Text).
 */
export function honorarSperrgrund(
  eingabe: string, betrag: number | undefined, verkaufssummeRappen: number | undefined,
): string | undefined {
  if (betrag !== undefined) return undefined;
  if (!verkaufssummeTaugt(verkaufssummeRappen)) {
    return 'Ohne Verkaufssumme lässt sich der Prozentsatz nicht in einen Betrag umrechnen.';
  }
  return eingabe.trim() === ''
    ? 'Bitte einen Honorarsatz in Prozent eingeben, um die Offerte zu erzeugen.'
    : 'Der eingegebene Prozentsatz ist ungültig.';
}
