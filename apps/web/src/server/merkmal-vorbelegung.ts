// Vorbelegung, kein Zwang: das Projekt darf Merkmale ergaenzen und entfernen.
import type { Konfiguration, Merkmal } from '@offert/core';

export function vorbelegteMerkmale(k: Konfiguration): readonly Merkmal[] {
  return k.merkmale.map((m) => ({ ...m }));
}
