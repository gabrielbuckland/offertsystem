// Keine Formel. Formatpruefung des vom Vermarkter gewaehlten Honorarbetrags. Eine
// Abweichung von der Range ist keine Formverletzung, sondern fachlich zulaessig (die
// Range ist eine Empfehlung, keine Schranke) — honorarAbweichung meldet sie gesondert
// fuer die Anzeige; die API-Route lehnt nur ein falsches Format ab. Die Positivpruefung
// ist noetig, weil gewaehltesHonorar eine Benutzereingabe (eigene Vertrauensgrenze) ist,
// anders als feeRange, das nie negativ wird.
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

// Anteil (0.032 statt 3.2) fuer formatiereHonorarProzent. null statt NaN/Infinity,
// wenn die Verkaufssumme keine sinnvolle Bezugsgroesse ist (<= 0).
export function berechneHonorarProzent(
  honorarRappen: number, verkaufssummeRappen: number,
): number | null {
  if (verkaufssummeRappen <= 0) return null;
  return honorarRappen / verkaufssummeRappen;
}

export type HonorarAbweichung = 'unter-range' | 'im-bereich' | 'ueber-range';

// Reine Einordnung, keine Ablehnung.
export function honorarAbweichung(
  betrag: number, range: { readonly min: number; readonly max: number },
): HonorarAbweichung {
  if (betrag < range.min) return 'unter-range';
  if (betrag > range.max) return 'ueber-range';
  return 'im-bereich';
}
