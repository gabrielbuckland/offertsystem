// Reine Logik rund um den gewaehlten Honorarsatz, getrennt von der Darstellung fuer
// DOM-freie Tests.
import { rundeAufRappen } from '@offert/core';
import { berechneHonorarProzent, formatiereHonorarProzent } from '@offert/offer';

export { honorarAbweichung, type HonorarAbweichung } from '@offert/offer';

// <= 0 oder fehlend ist keine sinnvolle Bezugsgroesse (Division durch null).
function verkaufssummeTaugt(wert: number | undefined): wert is number {
  return wert !== undefined && wert > 0;
}

// `–` statt einer kaputten Zahl, wenn die Verkaufssumme fehlt oder untauglich ist.
export function formatiereHonorarAlsProzent(
  betragRappen: number, verkaufssummeRappen: number | undefined,
): string {
  if (verkaufssummeRappen === undefined) return '–';
  const anteil = berechneHonorarProzent(betragRappen, verkaufssummeRappen);
  return anteil === null ? '–' : formatiereHonorarProzent(anteil);
}

// E-10: Rundung ueber `rundeAufRappen`, nicht `Math.round` — Betragsableitung wie
// R1-R3, muss denselben Rundungsmodus benutzen.
export function prozentEingabeZuRappen(
  text: string, verkaufssummeRappen: number | undefined,
): number | undefined {
  if (!verkaufssummeTaugt(verkaufssummeRappen)) return undefined;
  if (text.trim() === '') return undefined;
  const prozent = Number(text);
  if (!Number.isFinite(prozent)) return undefined;
  return rundeAufRappen((verkaufssummeRappen * prozent) / 100);
}

// Drei Faelle statt eines generischen Textes, damit der Vermarkter sieht, warum
// gesperrt ist.
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
