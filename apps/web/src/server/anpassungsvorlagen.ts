// E-25, US-04 AK 5: Vorlagen werden VORGESCHLAGEN, nicht vorbelegt — eine automatisch
// gesetzte Anpassung waere Automation Bias. Bei einer Vorlage MIT Bereichsregel werden
// Erfassungsform und Regel dennoch automatisch uebernommen: kein Wert wird gesetzt, die
// Regel wirkt erst, wenn der Vermarkter das Merkmal erfasst.
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

// Uebernahme ist Entscheidung des Vermarkters, nicht der Konfiguration: entsteht als
// gewoehnliche Anpassung (spaeter Provenanced<Adjustment, 'marketer-adjustment'>), ohne
// eigene Herkunftsklasse «Vorlage». `vorlageId` bleibt rein dokumentarisch.
export function uebernehmeVorlage(v: Anpassungsvorlage): UebernommeneAnpassung {
  return {
    faktor: v.vorgabefaktor,
    erfassungsform: 'relativ',
    begruendung: v.begruendungVorschlag,
    vorlageId: v.id,
  };
}
