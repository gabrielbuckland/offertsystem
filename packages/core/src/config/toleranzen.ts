// Keine Formel. Einzige Toleranzquelle (E-17, Brief §5.3). Der Kern importiert die Datei,
// die Property-Tests lesen dieselbe; A5 wird daraus gerendert.
import daten from '../../test/property/invariants.json' with { type: 'json' };

export type InvariantenId =
  | 'I-05' | 'I-08' | 'I-10' | 'I-11' | 'I-12' | 'I-14' | 'I-15' | 'I-17' | 'I-18' | 'I-22';

export interface Toleranz {
  readonly id: InvariantenId;
  readonly kurztext: string;
  readonly kette: 'preis' | 'score';
  readonly typ: 'exakt' | 'absolut' | 'rappen_je_randwert';
  readonly wert: number;
  readonly begruendung: string;
}

const tabelle: readonly Toleranz[] = daten as readonly Toleranz[];

export function alleToleranzen(): readonly Toleranz[] {
  return tabelle;
}

export function toleranzFuer(id: InvariantenId): Toleranz {
  const t = tabelle.find((x) => x.id === id);
  if (t === undefined) throw new Error(`Keine Toleranz zur Invariante ${id} hinterlegt`);
  return t;
}

/**
 * Schranke fuer I-17. Je Randwert entsteht durch R3 eine Abweichung von hoechstens
 * einem Rappen; fuer w = (H_max - H_min)/H_min folgt |dw| <= (1 + (1 + w)) / H_min.
 */
export function rangeBreiteToleranz(honorarMin: number, relativeBreite: number): number {
  const einRappen = toleranzFuer('I-17').wert;
  return (einRappen * (2 + relativeBreite)) / honorarMin;
}
