/**
 * Keine Formel. Anpassungs-Vorlagen aus den Company Defaults (E-25, US-04 AK 5).
 *
 * Vorlagen werden VORGESCHLAGEN, nicht vorbelegt. Eine automatisch gesetzte Anpassung
 * waere eine Entscheidung des Systems, die als Entscheidung des Vermarkters ausgewiesen
 * wuerde — ein Herkunftsfehler und die Musterform des Automation Bias.
 *
 * Das gilt fuer eine Vorlage OHNE Regel weiterhin uneingeschraenkt. Fuer eine Vorlage MIT
 * Bereichsregel gilt es nicht mehr im selben Sinn: `spalten-vorbelegung.ts`
 * (`vorbelegteSpalten`, die diese Funktion liest) uebernimmt Erfassungsform und Regel einer
 * regelbehafteten Vorlage automatisch in die neue Projektspalte. Das ist trotzdem kein
 * Automation Bias, weil kein Zu-/Abschlagswert gesetzt wird: Die Regel IST die Bedingung,
 * unter der die Anpassung greift, und wird erst wirksam, wenn der Vermarkter das zugehoerige
 * Merkmal an der Einheit erfasst (`ermittleWirksamenWert`). Ohne Merkmalswert ergibt sich
 * keine Position (siehe dortiger Kommentar).
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
