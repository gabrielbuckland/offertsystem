// I-1: offertText/auftraggeber sind nachweislich NICHT Teil der EingangsArgumente
// (server/projektion.ts liest sie nicht) — ohne diese Weiche loeste jeder Tastendruck im
// Offerttext-Editor einen vollen, kostenpflichtigen Rechenlauf aus. Invariante: aendert
// projektion.ts die gelesenen Felder, muss RECHENIRRELEVANTE_FELDER nachgezogen werden.
import type { Projekt } from '../../server/projekt-schema.js';

const RECHENIRRELEVANTE_FELDER = ['offertText', 'auftraggeber'] as const;

export function nurRechenirrelevanteFelderGeaendert(vorher: Projekt, nachher: Projekt): boolean {
  const ohneIrrelevante = (p: Projekt): Omit<Projekt, typeof RECHENIRRELEVANTE_FELDER[number]> => {
    const kopie: Record<string, unknown> = { ...p };
    for (const feld of RECHENIRRELEVANTE_FELDER) delete kopie[feld];
    return kopie as Omit<Projekt, typeof RECHENIRRELEVANTE_FELDER[number]>;
  };
  return JSON.stringify(ohneIrrelevante(vorher)) === JSON.stringify(ohneIrrelevante(nachher));
}
