/**
 * Wird eine Anpassungsspalte entfernt, muss ihr Wert aus JEDER Einheit verschwinden —
 * sonst lebt er bei einer spaeter wiederverwendeten Spalten-ID unbeabsichtigt wieder
 * auf. Einziger Ort, der diese Kaskade ausfuehrt.
 */
import type { ProjektEinheit } from '../../server/projekt-schema.js';

export function entferneSpaltenwert(
  einheiten: readonly ProjektEinheit[], spaltenId: string,
): readonly ProjektEinheit[] {
  return einheiten.map((einheit) => {
    if (!(spaltenId in einheit.spaltenwerte)) return einheit;
    const { [spaltenId]: _entfernt, ...rest } = einheit.spaltenwerte;
    return { ...einheit, spaltenwerte: rest };
  });
}
