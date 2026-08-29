// eq:normalisierung. Iteration ueber die konfigurierte Faktormenge, aufsteigend nach
// FaktorId; kein faktorspezifischer Zweig (I-13). Sonderfaelle: S-01, S-02.
import { fehlschlag, ok, type Result } from '../domain/result.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import { loeseStrategieAuf } from '../normalization/registry.js';
import type { NormalisierterFaktor } from '../normalization/strategie.js';
import { sortiereNachSchluessel } from '../util/sortierung.js';
import type { GeschlossenerEingang } from './stufe2a-abgeleitete.js';

export interface NormalisierungErgebnis {
  readonly faktoren: readonly NormalisierterFaktor[]; // sortiert nach faktorId
}

export function normalisiereFaktoren(
  eingang: GeschlossenerEingang,
): Result<NormalisierungErgebnis, StufenFehler> {
  const faktoren: NormalisierterFaktor[] = [];
  for (const [id, parameter] of sortiereNachSchluessel(eingang.konfiguration.faktoren)) {
    const rohwert = eingang.rohfaktoren.get(id);
    if (rohwert === undefined) {
      return fehlschlag(
        stufenFehler(3, 'FAKTOR_FEHLT', {
          faktorId: id, bezeichnung: parameter.bezeichnung, quelle: parameter.quelle,
          quellSchluessel: parameter.quellSchluessel, phase: 'rohwert',
        }, { faktor: id }),
      );
    }
    const ergebnis = loeseStrategieAuf(parameter.strategie).normalisiere(rohwert, parameter, id);
    if (!ergebnis.ok) return fehlschlag(ergebnis.fehler);
    faktoren.push(ergebnis.wert);
  }
  return ok({ faktoren });
}
