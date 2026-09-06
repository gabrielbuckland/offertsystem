/**
 * Keine Modellformel; eine Operation des WERKZEUGS, nicht der Pipeline.
 *
 * zMin/zMax wirken nicht kappend, sondern zurueckweisend (I-07): eine
 * Einheit mit z_j ausserhalb der Grenzen laesst Stufe 1 fehlschlagen. Eine blosse
 * Verengung des Korridors erzeugte beim tragenden Szenario fuer D3 deshalb keinen
 * Messwert, sondern einen Eingabefehler.
 *
 * Das Werkzeug projiziert deshalb: z_j' = min(zMax, max(zMin, z_j)), als PROPORTIONALE
 * Skalierung der Einzelanpassungen, damit die Einzelausweisung mit Begruendung (I-09)
 * erhalten bleibt. Anzahl betroffener Positionen wird im Artefakt ausgewiesen.
 *
 * I-06 ist per Konstruktion gewahrt: Die Projektion bildet stets auf [zMin, zMax] ab, und
 * zMin > -1 erzwingt bereits die Konfigurationsvalidierung (CFG_ADJUSTMENT_BOUNDS).
 */
import type { SzenarioEinheit } from '../shared/szenario.ts';

export interface ProjektionErgebnis {
  readonly einheiten: readonly SzenarioEinheit[];
  readonly projiziert: number;
}

export function projiziereAufKorridor(
  einheiten: readonly SzenarioEinheit[],
  zMin: number,
  zMax: number,
): ProjektionErgebnis {
  let projiziert = 0;
  const neu = einheiten.map((e) => {
    const z = e.anpassungen.reduce((a, x) => a + x.a_i, 0);
    const ziel = Math.min(zMax, Math.max(zMin, z));
    if (ziel === z || z === 0) return e;
    projiziert += 1;
    const faktor = ziel / z;
    return { ...e, anpassungen: e.anpassungen.map((a) => ({ ...a, a_i: a.a_i * faktor })) };
  });
  return { einheiten: neu, projiziert };
}
