// eq:aufwandindikator, Nebenbedingung Sigma w_d = 1. Ein strikt isoliertes Variieren
// eines Gewichts ist darunter nicht moeglich; die uebrigen Gewichte werden deshalb
// PROPORTIONAL zu ihrem bisherigen Verhaeltnis renormalisiert (w_i' = w_i*(1+delta),
// w_j' = w_j*(1-w_i')/(1-w_i) fuer j != i). Die Messung ist damit eine Aussage ueber die
// RELATIVE Verschiebung eines Gewichts, nicht ueber eine isolierte Aenderung.
import { sortiereNachSchluessel } from '../shared/artefakt.ts';

export interface RenormErgebnis {
  readonly status: 'ok' | 'unzulaessig';
  readonly grund: string | null;
  readonly gewichte_vor: Readonly<Record<string, number>>;
  readonly gewichte: Readonly<Record<string, number>> | null;
}

export function renormalisiere(
  gewichte: Readonly<Record<string, number>>,
  faktorId: string,
  delta: number,
): RenormErgebnis {
  const wI = gewichte[faktorId];
  if (wI === undefined) {
    return {
      status: 'unzulaessig', grund: `Faktor ${faktorId} unbekannt`,
      gewichte_vor: gewichte, gewichte: null,
    };
  }
  const wINeu = wI * (1 + delta);
  if (wINeu <= 0) {
    return {
      status: 'unzulaessig', grund: 'Zielgewicht nicht positiv',
      gewichte_vor: gewichte, gewichte: null,
    };
  }
  if (wINeu >= 1) {
    return {
      status: 'unzulaessig', grund: 'kein Restgewicht fuer die uebrigen Faktoren',
      gewichte_vor: gewichte, gewichte: null,
    };
  }
  const skala = (1 - wINeu) / (1 - wI);
  const neu: Record<string, number> = {};
  for (const [id, w] of sortiereNachSchluessel(gewichte)) {
    neu[id] = id === faktorId ? wINeu : w * skala;
  }
  return { status: 'ok', grund: null, gewichte_vor: gewichte, gewichte: neu };
}
