/**
 * Keine Formel. Erzeugung der Laufmetadaten (E-29).
 *
 * Weder Kern noch Adapter erzeugen Bezeichner oder Zeitstempel: Sonst lieferten zwei
 * Laeufe derselben Eingabe verschiedene Artefakte, und I-14 waere praktisch unpruefbar.
 * Beides entsteht genau hier und wird hineingereicht.
 *
 * Die Pruefsumme wird UEBERNOMMEN, nicht gebildet (PE-04): Sie entsteht einmal im Lader
 * aus der kanonisch serialisierten effektiven Konfiguration. Eine zweite Serialisierung
 * ueber dasselbe Objekt liefe bei der ersten Abweichung — Behandlung von `undefined`,
 * `Map`, Zahlformat — auseinander, und die Pruefsumme in den Metadaten belegte dann
 * etwas anderes als die des Laders.
 */
import { randomUUID } from 'node:crypto';
import type { KonfigurationsFingerabdruck } from './konfigurations-lader.js';

export interface LaufmetadatenQuelle {
  readonly neueId: () => string;
  readonly naechsteReferenznummer: () => string;
  readonly jetzt: () => string;
}

export interface Laufmetadaten {
  readonly offertId: string;
  readonly referenznummer: string;
  readonly erstelltAm: string;
  readonly konfigVersion: string;
  readonly konfigPruefsumme: string;
}

/**
 * Laufende Nummer innerhalb des Prozesses. Vorlaeufig: Das endgueltige Muster der
 * Referenznummer ist beim Auftraggeber offen (OFFEN-05-1). Die Nummer ist bewusst kein
 * Datentraeger — alles, was sie andeutet, steht auch im Dokument.
 */
let laufendeNummer = 0;

function naechsteNummer(): string {
  laufendeNummer += 1;
  return String(laufendeNummer).padStart(3, '0');
}

/** Vorlaeufiges Muster A-<Jahr>-<laufende Nummer> bis zur Festlegung (OFFEN-05-1). */
export const laufzeitQuelle: LaufmetadatenQuelle = {
  neueId: () => randomUUID(),
  naechsteReferenznummer: () => `A-${new Date().getFullYear()}-${naechsteNummer()}`,
  jetzt: () => new Date().toISOString(),
};

export function erzeugeLaufmetadaten(
  fingerabdruck: KonfigurationsFingerabdruck,
  quelle: LaufmetadatenQuelle = laufzeitQuelle,
): Laufmetadaten {
  return {
    offertId: quelle.neueId(),
    referenznummer: quelle.naechsteReferenznummer(),
    erstelltAm: quelle.jetzt(),
    konfigVersion: fingerabdruck.konfigVersion,
    konfigPruefsumme: fingerabdruck.konfigPruefsumme,
  };
}
