/**
 * Reine Loeschkaskade fuer `spaltenwerte`, getrennt von `ProjektAnsicht.tsx` und direkt
 * testbar (wie `zellen-logik.ts` fuer die Zelleingabe).
 *
 * Wird eine Anpassungsspalte entfernt (`AnpassungsSpalten.entferneSpalte`), muss ihr
 * Wert aus JEDER Einheit verschwinden — sonst traegt das Artefakt einen Wert ohne
 * Spalte, den die Projektion still ignoriert und der bei einer spaeter
 * wiederverwendeten Spalten-ID unbeabsichtigt wieder auflebt (Kommentar in
 * `AnpassungsSpalten.tsx`). Diese Funktion ist der EINZIGE Ort, der diese Kaskade
 * ausfuehrt; `ProjektAnsicht.tsx` ruft sie auf, statt die Logik ein zweites Mal inline
 * zu halten.
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
