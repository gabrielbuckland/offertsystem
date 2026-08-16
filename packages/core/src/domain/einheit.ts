// Keine Formel. `parkplaetze` wird gefuehrt (US-01), geht aber gemaess Scope-Ausschluss
// (Brief §8) in keine Formel ein und wird in der Preisableitung nicht referenziert.
import type { Quadratmeter } from './geld.js';
import type { EinheitId, Wohnungsnummer, WohnungstypId } from './ids.js';
import type { ZuAbschlag } from './zuabschlag.js';

export interface Einheit {
  readonly id: EinheitId;
  readonly wohnungsnummer: Wohnungsnummer;
  readonly wohnungstypId: WohnungstypId;
  readonly flaecheInnen: Quadratmeter;
  readonly flaecheAussen: Quadratmeter;
  readonly stockwerk: number;
  readonly parkplaetze: number;
  readonly anpassungen: readonly ZuAbschlag[];
}
