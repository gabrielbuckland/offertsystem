/**
 * Anpassungs-Vorlagen aus den Company Defaults (E-25, US-04 AK 5). Vorlagen werden
 * VORGESCHLAGEN, nicht vorbelegt — eine automatisch gesetzte Anpassung waere ein
 * Herkunftsfehler und die Musterform des Automation Bias. Bei einer Vorlage MIT
 * Bereichsregel uebernimmt `spalten-vorbelegung.ts` Erfassungsform und Regel automatisch,
 * das ist trotzdem kein Automation Bias: kein Zu-/Abschlagswert wird gesetzt, die Regel
 * wird erst wirksam, wenn der Vermarkter das Merkmal erfasst (`ermittleWirksamenWert`).
 */
import type { Konfiguration, KernAnpassungsVorlage } from '@offert/core';

export type Anpassungsvorlage = KernAnpassungsVorlage;

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
