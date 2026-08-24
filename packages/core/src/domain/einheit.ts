// Keine Formel. `stockwerk` geht in keine Formel ein, wird aber gefuehrt: Es ist die
// Grundlage, auf der der Vermarkter den Zu- oder Abschlag je Einheit waehlt (die
// Vorlagen `Attikawohnung`, `Erdgeschoss mit Gartensitzplatz` und `Erdgeschoss, stark
// einsehbar` beziehen sich darauf). Nicht entfernen, weil `keine Formel` ist.
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
  readonly anpassungen: readonly ZuAbschlag[];
}
