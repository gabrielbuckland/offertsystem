/**
 * Keine Formel. Leitet die Merkmale eines neuen Projekts aus der firmenweiten
 * Konfiguration ab. Wie beim Spaltenschnitt ist das eine Vorbelegung, kein Zwang:
 * Das Projekt darf Merkmale ergaenzen und entfernen.
 */
import type { Konfiguration, Merkmal } from '@offert/core';

export function vorbelegteMerkmale(k: Konfiguration): readonly Merkmal[] {
  return k.merkmale.map((m) => ({ ...m }));
}
