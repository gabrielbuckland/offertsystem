// Reine Weiche, ob ein Speichervorgang eine Neuberechnung nach sich ziehen muss (I-1).
// `offertText` und `auftraggeber` sind nachweislich NICHT Teil der `EingangsArgumente`
// (`server/projektion.ts` liest beide Felder nicht) — ohne diese Weiche loeste jeder
// Tastendruck im Offerttext-Editor einen vollen, ungecachten Rechenlauf inkl. kostenpflichtiger
// PriceHubble-Abrufe fuer reine Prosa aus. Invariante: Aendert `projektion.ts` die Menge der
// gelesenen Felder, muss `RECHENIRRELEVANTE_FELDER` synchron nachgezogen werden.
import type { Projekt } from '../../server/projekt-schema.js';

const RECHENIRRELEVANTE_FELDER = ['offertText', 'auftraggeber'] as const;

// `false` heisst: mindestens ein rechenrelevantes Feld hat sich geaendert (oder es ist der
// erste Vergleich) — dann MUSS eine Berechnung folgen.
export function nurRechenirrelevanteFelderGeaendert(vorher: Projekt, nachher: Projekt): boolean {
  const ohneIrrelevante = (p: Projekt): Omit<Projekt, typeof RECHENIRRELEVANTE_FELDER[number]> => {
    const kopie: Record<string, unknown> = { ...p };
    for (const feld of RECHENIRRELEVANTE_FELDER) delete kopie[feld];
    return kopie as Omit<Projekt, typeof RECHENIRRELEVANTE_FELDER[number]>;
  };
  return JSON.stringify(ohneIrrelevante(vorher)) === JSON.stringify(ohneIrrelevante(nachher));
}
