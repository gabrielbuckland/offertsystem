/**
 * Keine Formel. Leitet die Spalten eines neuen Projekts aus den firmenweiten Vorlagen ab.
 *
 * Vorbelegung statt Vorgabe: Die Vorlagen sind ein Vorschlag (US-04 AK 5, E-25). Das
 * Projekt darf Spalten ergaenzen, umbenennen und entfernen; das Excel des Auftraggebers
 * zeigt je Blatt einen anderen Spaltenschnitt.
 *
 * `Anpassungsvorlage` fuehrt kein Feld `bezeichnung` (siehe anpassungsvorlagen.ts) —
 * `begruendungVorschlag` ist der einzige lesbare Text der Vorlage und wird ohnehin zur
 * `begruendung` jeder aus dieser Spalte abgeleiteten Position (projektion.ts).
 */
import type { Konfiguration } from '@offert/core';
import { leseVorlagen } from './anpassungsvorlagen.js';
import type { AnpassungsSpalte } from './projekt-schema.js';

export function vorbelegteSpalten(k: Konfiguration): readonly AnpassungsSpalte[] {
  return leseVorlagen(k).map((v, i) => ({
    id: `S-${i + 1}`,
    bezeichnung: v.begruendungVorschlag,
    erfassungsform: 'relativ' as const,
    vorgabewert: v.vorgabefaktor,
  }));
}
