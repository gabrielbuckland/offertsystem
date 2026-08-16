// Keine Formel. Bezeichner werden hereingereicht, nie im Kern erzeugt (Spec 03 §9.2, E-29).
import type { Branded } from './brand.js';

export type LiegenschaftId = Branded<string, 'LiegenschaftId'>;
export type WohnungstypId = Branded<string, 'WohnungstypId'>;
export type EinheitId = Branded<string, 'EinheitId'>;
export type Wohnungsnummer = Branded<string, 'Wohnungsnummer'>;
export type FaktorId = Branded<string, 'FaktorId'>;
export type LagescoreName = Branded<string, 'LagescoreName'>;

function pruefeNichtLeer(wert: string, typ: string): void {
  if (wert.trim().length === 0) {
    throw new Error(`${typ} darf nicht leer sein`);
  }
}

export function liegenschaftId(w: string): LiegenschaftId {
  pruefeNichtLeer(w, 'LiegenschaftId');
  return w as LiegenschaftId;
}
export function wohnungstypId(w: string): WohnungstypId {
  pruefeNichtLeer(w, 'WohnungstypId');
  return w as WohnungstypId;
}
export function einheitId(w: string): EinheitId {
  pruefeNichtLeer(w, 'EinheitId');
  return w as EinheitId;
}
export function wohnungsnummer(w: string): Wohnungsnummer {
  pruefeNichtLeer(w, 'Wohnungsnummer');
  return w as Wohnungsnummer;
}
export function faktorId(w: string): FaktorId {
  pruefeNichtLeer(w, 'FaktorId');
  return w as FaktorId;
}
export function lagescoreName(w: string): LagescoreName {
  pruefeNichtLeer(w, 'LagescoreName');
  return w as LagescoreName;
}
