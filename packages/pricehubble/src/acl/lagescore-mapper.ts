/**
 * Keine Formel. Keine Verdichtung zu einem Sammelwert (I-26). Keine Umpolung von
 * `noise`/`nuisance` hier — geschieht ueber vertauschte Normalisierungsgrenzen in der
 * Konfiguration (I-13), sonst waere ein neuer Faktor wieder eine Codeaenderung (FF 1).
 * Schluessel ist `LagescoreName`, nicht `FaktorId` (E-08); Aufloesung macht der
 * Beschaffer im Kern. `meta` ist Ausweisinformation (A-13), kein Berechnungseingang.
 * Ein fehlender Score ist bereits im Schema ein Vertragsbruch (E-22) und erreicht diese
 * Funktion nicht.
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
    const eintrag = antwort.scores[name];
    const schluessel = name as unknown as LagescoreName;
    werte.set(schluessel, eintrag.score as Score);
    meta.set(schluessel, {
      originalScore: (eintrag.originalScore ?? eintrag.score) as Score,
      isOverridden: eintrag.isOverridden ?? false,
    });
  }

  return { werte, meta, abrufdatum, anbieter: ANBIETER };
}
