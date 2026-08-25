// Keine Formel. Die Einheit fuehrt bewusst KEIN eigenes Merkmalsfeld ausser den Flaechen:
// Was den Preis gegenueber dem Referenzobjekt verschiebt, ist ausschliesslich `anpassungen`
// — eine offene, konfigurierbare Liste von Zu- und Abschlaegen. Ein festes Feld wie das
// frueher gefuehrte `stockwerk` ging in keine Formel ein und war nur Ablesegrundlage fuer
// die Wahl eines Zu-/Abschlags; als hart verdrahtetes Merkmal machte es jede weitere
// Kategorie zu einer Codeaenderung. Die Stockwerklage wird deshalb dort erfasst, wo sie
// wirkt: als Anpassungsspalte (Vorlagen `attikalage`, `erdgeschoss_gartensitzplatz`,
// `erdgeschoss_einsehbar` in der firmenweiten Konfiguration).
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
