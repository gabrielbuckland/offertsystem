/**
 * Keine Formel. Formatpruefung des vom Vermarkter gewaehlten Honorarbetrags
 * (`aggregates.gewaehltesHonorar`, Spec 2026-08-29).
 *
 * Geprueft wird die Form (R3: Ganzzahl in Rappen, wie `feeRange.min/max`) UND die
 * Positivitaet. Eine Abweichung von der Honorarrange ist KEINE Formverletzung, sondern
 * ein fachlich zulaessiger Fall: Die Range ist eine Empfehlung an den Vermarkter, keine
 * Schranke. `honorarAbweichung` meldet die Abweichung gesondert, fuer die Anzeige im
 * Eingabemodal (`apps/web/src/components/ui/honorar-eingabe-dialog.tsx`); die API-Route
 * lehnt nur ein falsches FORMAT (inkl. Nicht-Positivitaet) ab, nie eine Abweichung von
 * der Range.
 *
 * Die Positivpruefung (Review-Befund 2026-08-29) traegt NICHT `feeRange` (die ist ein
 * berechneter Wert, der nie negativ wird): `gewaehltesHonorar` ist eine Benutzereingabe
 * und damit eine eigene Vertrauensgrenze — ohne diese Pruefung liesse sich ein
 * Honorar von z. B. -50'000 CHF erfassen und unveraendert ins Kundendokument drucken.
 */
export type HonorarPruefung =
  | { readonly ok: true; readonly wert: number }
  | { readonly ok: false; readonly text: string };

export function validiereGewaehltesHonorar(wert: unknown): HonorarPruefung {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) {
    return { ok: false, text: 'Der Honorarbetrag fehlt oder ist keine Zahl.' };
  }
  if (!Number.isInteger(wert)) {
    return { ok: false, text: 'Der Honorarbetrag muss ganzzahlig in Rappen sein.' };
  }
  if (wert <= 0) {
    return { ok: false, text: 'Der Honorarbetrag muss positiv sein.' };
  }
  return { ok: true, wert };
}

/**
 * Honorar als Anteil (nicht Prozentzahl, also 0.032 statt 3.2) der Verkaufssumme, fuer
 * `formatiereHonorarProzent` (Spec 2026-08-29). `null` statt `NaN`/`Infinity`, wenn die
 * Verkaufssumme keine sinnvolle Bezugsgroesse ist (<= 0) — die Anzeige entscheidet dann
 * selbst ueber einen Platzhaltertext, statt eine kaputte Zahl zu erhalten.
 */
export function berechneHonorarProzent(
  honorarRappen: number, verkaufssummeRappen: number,
): number | null {
  if (verkaufssummeRappen <= 0) return null;
  return honorarRappen / verkaufssummeRappen;
}

export type HonorarAbweichung = 'unter-range' | 'im-bereich' | 'ueber-range';

/** Reine Einordnung, keine Ablehnung: siehe Dateikopf. */
export function honorarAbweichung(
  betrag: number, range: { readonly min: number; readonly max: number },
): HonorarAbweichung {
  if (betrag < range.min) return 'unter-range';
  if (betrag > range.max) return 'ueber-range';
  return 'im-bereich';
}
