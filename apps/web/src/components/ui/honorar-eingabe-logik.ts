// Reine Logik des Honorar-Eingabemodals, getrennt von der Darstellung fuer DOM-freie Tests.
import { berechneHonorarProzent, formatiereHonorarProzent } from '@offert/offer';

export { honorarAbweichung, type HonorarAbweichung } from '@offert/offer';

/**
 * Formatierte Prozentanzeige eines Frankenbetrags (Empfehlungsrange oder Eingabe) an der
 * Verkaufssumme: Anzeige ist Prozent, Eingabefeld bleibt Franken. `–` statt einer
 * kaputten Zahl, wenn die Verkaufssumme fehlt oder keine sinnvolle Bezugsgroesse ist.
 */
export function formatiereHonorarAlsProzent(
  betragRappen: number, verkaufssummeRappen: number | undefined,
): string {
  if (verkaufssummeRappen === undefined) return '–';
  const anteil = berechneHonorarProzent(betragRappen, verkaufssummeRappen);
  return anteil === null ? '–' : formatiereHonorarProzent(anteil);
}

/** Franken-Eingabe -> Rappen, gerundet. `undefined` bei nicht parsierbarer Eingabe. */
export function frankenEingabeZuRappen(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const wert = Number(text);
  return Number.isFinite(wert) ? Math.round(wert * 100) : undefined;
}

/**
 * Sperrgrund fuers Bestaetigen, oder `undefined`, wenn ein gueltiger Betrag vorliegt.
 * Das Feld startet LEER — keine Vorbelegung mit dem Range-Mittelwert. Eine
 * Systemvorbelegung, die der Vermarkter nur noch bestaetigt, liefe als SEINE Entscheidung
 * ins Dokument (Herkunft `marketer-decision`), obwohl sie das System gesetzt hat
 * (Automation Bias). Zwei Faelle statt eines generischen Textes, damit der Vermarkter
 * sieht, WARUM gesperrt ist: nichts eingegeben vs. eine unbrauchbare Eingabe (z. B. Text).
 */
export function honorarSperrgrund(eingabe: string, betrag: number | undefined): string | undefined {
  if (betrag !== undefined) return undefined;
  return eingabe.trim() === ''
    ? 'Bitte einen Honorarbetrag eingeben, um die Offerte zu erzeugen.'
    : 'Der eingegebene Betrag ist ungültig.';
}
