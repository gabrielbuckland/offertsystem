/**
 * Anti-Corruption Layer, Lagerichtung (Spec 04 §4.2). Keine Formel.
 *
 * Drei Festlegungen, die hier durchgesetzt werden:
 *  - KEINE Verdichtung zu einem Sammelwert (I-26).
 *  - KEINE Umpolung von `noise`/`nuisance` im ACL; sie geschieht ausschliesslich ueber
 *    vertauschte Normalisierungsgrenzen in der Konfiguration (I-13). Jede
 *    Sonderbehandlung hier machte einen neuen Faktor wieder zu einer Codeaenderung
 *    und verfehlte FF 1.
 *  - Schluessel ist `LagescoreName`, nicht `FaktorId` (E-08). Die Aufloesung
 *    `FaktorId -> quellSchluessel -> LagescoreName` leistet der Beschaffer im Kern.
 *
 * `meta` ist Ausweisinformation fuer A-13 und ausdruecklich kein Berechnungseingang.
 *
 * Ein fehlender Score ist bereits im Schema ein Vertragsbruch (E-22) und erreicht
 * diese Funktion nicht.
 */
import type { Lagescores, LagescoreName, Score } from '@offert/core';
import {
  LAGESCORE_NAMEN,
  type LocationScoresResponse,
} from '../schema/location-scores-response.js';
import { ANBIETER } from './bewertung-mapper.js';

export function aufLagescores(
  antwort: LocationScoresResponse,
  abrufdatum: string,
): Lagescores {
  const werte = new Map<LagescoreName, Score>();
  const meta = new Map<LagescoreName, { originalScore: Score; isOverridden: boolean }>();

  for (const name of LAGESCORE_NAMEN) {
    const eintrag = antwort[name];
    const schluessel = name as unknown as LagescoreName;
    werte.set(schluessel, eintrag.score as Score);
    meta.set(schluessel, {
      originalScore: (eintrag.originalScore ?? eintrag.score) as Score,
      isOverridden: eintrag.isOverridden ?? false,
    });
  }

  return { werte, meta, abrufdatum, anbieter: ANBIETER };
}
