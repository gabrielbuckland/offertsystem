// Keine Formel. Bewusst kein eigenes Merkmalsfeld ausser den Flaechen: was den Preis
// gegenueber dem Referenzobjekt verschiebt, laeuft ausschliesslich ueber `anpassungen`
// (offene, konfigurierbare Liste), sonst waere jede neue Kategorie eine Codeaenderung.
import type { Quadratmeter } from './geld.js';
import type { EinheitId, Wohnungsnummer, WohnungstypId } from './ids.js';
import type { ZuAbschlag } from './zuabschlag.js';

export interface Einheit {
  readonly id: EinheitId;
  readonly wohnungsnummer: Wohnungsnummer;
  readonly wohnungstypId: WohnungstypId;
  readonly flaecheInnen: Quadratmeter;
  readonly flaecheAussen: Quadratmeter;
  readonly anpassungen: readonly ZuAbschlag[];
}
