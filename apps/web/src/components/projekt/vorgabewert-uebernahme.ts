import type { AnpassungsSpalte, ProjektEinheit } from '../../server/projekt-schema.js';

// I-24: 0 gilt als erfasster Wert, nicht als fehlend — bestehende Werte bleiben unangetastet.
export function uebernehmeVorgabewert(
  einheiten: readonly ProjektEinheit[], spalte: AnpassungsSpalte,
): readonly ProjektEinheit[] {
  if (spalte.vorgabewert === undefined) return einheiten;
  const vorgabewert = spalte.vorgabewert;
  return einheiten.map((einheit) => {
    if (spalte.id in einheit.spaltenwerte) return einheit;
    return {
      ...einheit,
      spaltenwerte: { ...einheit.spaltenwerte, [spalte.id]: vorgabewert },
    };
  });
}
