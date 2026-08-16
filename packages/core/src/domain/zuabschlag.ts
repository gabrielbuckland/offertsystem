// Keine Formel. Value Object zu eq:wohnungspreis: die Einzelbeitraege a_j,i.
// `erfassungsform`, `erfassterBetrag` und `vorlageId` sind rein dokumentarisch (I-09, A-14)
// und gehen in keine Formel ein.
import type { Rappen } from './geld.js';

export interface ZuAbschlag {
  readonly faktor: number;
  readonly begruendung: string;
  readonly erfassungsform: 'relativ' | 'absolut';
  readonly erfassterBetrag?: Rappen;
  readonly vorlageId?: string;
}
