/**
 * Keine Formel. Anpassungs-Vorlagen aus den Company Defaults (E-25, US-04 AK 5).
 *
 * Vorlagen werden VORGESCHLAGEN, nicht vorbelegt. Eine automatisch gesetzte Anpassung
 * waere eine Entscheidung des Systems, die als Entscheidung des Vermarkters ausgewiesen
 * wuerde — ein Herkunftsfehler und die Musterform des Automation Bias.
 */
import type { AnpassungsVorlage, Konfiguration } from '@offert/core';

export type Anpassungsvorlage = AnpassungsVorlage;

export function leseVorlagen(k: Konfiguration): readonly Anpassungsvorlage[] {
  return k.anpassungsVorlagen;
}

export interface UebernommeneAnpassung {
  readonly faktor: number;
  readonly erfassungsform: 'relativ';
  readonly begruendung: string;
  readonly vorlageId: string;
}

/**
 * Die Uebernahme ist eine Entscheidung des Vermarkters, nicht der Konfiguration. Deshalb
 * entsteht eine gewoehnliche Anpassung: im Datenobjekt spaeter
 * Provenanced<Adjustment, 'marketer-adjustment'>, ohne eigene Herkunftsklasse «Vorlage»,
 * die die Verantwortung verwischen wuerde. `vorlageId` bleibt rein dokumentarisch.
 *
 * Die Konfiguration wird gelesen, nie beschrieben: Das zurueckgegebene Objekt ist neu.
 */
export function uebernehmeVorlage(v: Anpassungsvorlage): UebernommeneAnpassung {
  return {
    faktor: v.vorgabefaktor,
    erfassungsform: 'relativ',
    begruendung: v.begruendungVorschlag,
    vorlageId: v.id,
  };
}
