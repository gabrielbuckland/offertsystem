// Keine Formel. Die Einheit fuehrt bewusst kein eigenes Merkmalsfeld ausser den Flaechen:
// Was den Preis gegenueber dem Referenzobjekt verschiebt, ist ausschliesslich `anpassungen`
// — eine offene, konfigurierbare Liste von Zu- und Abschlaegen. Ein hart verdrahtetes
// Merkmal machte jede weitere Kategorie zu einer Codeaenderung; solche Merkmale werden
// deshalb als Anpassungsspalte erfasst (Vorlagen `attikalage`,
// `erdgeschoss_gartensitzplatz`, `erdgeschoss_einsehbar` in der firmenweiten Konfiguration).
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
