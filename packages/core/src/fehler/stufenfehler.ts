// Keine Formel. Der Kern erzeugt keinen Fliesstext (E-03).
import type { FaktorId, Wohnungsnummer, WohnungstypId } from '../domain/ids.js';
import type { BerechnungsFehlerCode } from './codes.js';

export type StufenParameter = Readonly<Record<string, string | number | readonly string[]>>;

export interface StufenBezug {
  readonly einheit?: Wohnungsnummer;
  readonly wohnungstyp?: WohnungstypId;
  readonly faktor?: FaktorId;
}

export interface StufenFehler {
  readonly stufe: 1 | 2 | 3 | 4 | 5;
  readonly code: BerechnungsFehlerCode;
  readonly parameter: StufenParameter;
  readonly bezug?: StufenBezug;
}

export function stufenFehler(
  stufe: 1 | 2 | 3 | 4 | 5,
  code: BerechnungsFehlerCode,
  parameter: StufenParameter,
  bezug?: StufenBezug,
): StufenFehler {
  const wert: StufenFehler =
    bezug === undefined
      ? { stufe, code, parameter: Object.freeze({ ...parameter }) }
      : { stufe, code, parameter: Object.freeze({ ...parameter }), bezug: Object.freeze({ ...bezug }) };
  return Object.freeze(wert);
}
