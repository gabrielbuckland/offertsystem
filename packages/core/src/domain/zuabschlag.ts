// Keine Formel. Value Object zu eq:wohnungspreis: die Einzelbeitraege a_j,i.
// `erfassungsform`, `erfassterBetrag`, `vorlageId` sowie `regel` und `uebersteuert` sind
// rein dokumentarisch (I-09, A-14) und gehen in keine Formel ein.
import type { Rappen } from './geld.js';

/**
 * Nachweis der Bereichsregel, aus der `faktor` stammt (siehe `modell/bereichsregel.ts`).
 * Rein dokumentarisch wie die uebrigen optionalen Felder von `ZuAbschlag`: Der Kern
 * wertet keine Regel aus, er erhaelt und fuehrt nur ihr Ergebnis mit.
 */
export interface Regelspur {
  readonly merkmal: string;
  readonly merkmalswert: number;
  readonly bereich: number;
  readonly regelwert: number;
}

export interface ZuAbschlag {
  readonly faktor: number;
  readonly begruendung: string;
  readonly erfassungsform: 'relativ' | 'absolut';
  readonly erfassterBetrag?: Rappen;
  readonly vorlageId?: string;
  /** Regel und Uebersteuerung sind unabhaengig optional: Eine Uebersteuerung kann ohne
   *  Regelnachweis auftreten, wenn das Merkmal der Regel an dieser Einheit keinen Wert
   *  hat. */
  readonly regel?: Regelspur;
  readonly uebersteuert?: true;
}
