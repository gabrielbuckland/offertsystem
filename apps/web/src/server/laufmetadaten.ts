/**
 * Erzeugung der Laufmetadaten (E-29). Weder Kern noch Adapter erzeugen Bezeichner oder
 * Zeitstempel, sonst lieferten zwei Laeufe derselben Eingabe verschiedene Artefakte
 * (I-14 unpruefbar). Pruefsumme wird UEBERNOMMEN, nicht gebildet (PE-04) — sie entsteht
 * einmal im Lader; eine zweite Serialisierung koennte abweichen.
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
 * Laufende Nummer innerhalb des Prozesses. Das Muster der Referenznummer ist vorlaeufig.
 * Die Nummer ist bewusst kein Datentraeger — alles, was sie andeutet, steht auch im
 * Dokument.
 */
let laufendeNummer = 0;

function naechsteNummer(): string {
  laufendeNummer += 1;
  return String(laufendeNummer).padStart(3, '0');
}

/** Vorlaeufiges Muster A-<Jahr>-<laufende Nummer>. */
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
