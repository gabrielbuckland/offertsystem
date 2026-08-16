/**
 * Zusammenbauschicht. Nur hier treffen Konfiguration, Provider-Implementierung
 * und Vorlage aufeinander; nur hier werden Umgebungsvariablen gelesen
 * (Spec 01 §7.2) und die Konfigurationspruefsumme gebildet (E-26).
 */
export const PAKET_NAME = '@offert/web';

export { bildePruefsumme, kanonischSerialisieren } from './kanonisch.js';
export {
  ladeKonfiguration,
  leereZwischenspeicher,
  type KonfigurationsFingerabdruck,
  type LadeErgebnis,
  type LadeOptionen,
} from './konfigurations-lader.js';
export { leseUmgebung, type ProviderSchalter, type Umgebung, type UmgebungsErgebnis } from './umgebung.js';
