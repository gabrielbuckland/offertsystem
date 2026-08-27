/**
 * Reine Weiche, ob ein Speichervorgang eine Neuberechnung nach sich ziehen muss (I-1).
 *
 * `ProjektAnsicht` kettet die Berechnung an den ERFOLG jedes Speicherns
 * (`verwendeProjekt(anfang, (gespeichert) => stelleEin(gespeichert))`, siehe deren
 * Kommentar). Das ist fuer Zahlenfelder richtig und bewusst so gebaut — der
 * Offerttext (`offertText`) und der Auftraggeber (`auftraggeber`) sind aber
 * nachweislich NICHT Teil der `EingangsArgumente` (`server/eingang.ts`,
 * `server/projektion.ts` liest beide Felder nicht): Ein reiner Textänderungs- oder
 * Empfänger-Speichervorgang kann also kein einziges Berechnungsergebnis verändern.
 *
 * Ohne diese Weiche loeste jeder Tastendruck im Offerttext-Editor nach 400ms
 * Entprellung einen vollstaendigen zweistufigen Rechenlauf samt Bewertungsabrufen
 * (`beschaffe` -> `provider.holeLagescores`/`bewerteWohnungstypen`, ungecacht) aus —
 * mit `VALUATION_PROVIDER=pricehubble` sind das echte, kostenpflichtige Abrufe fuer
 * reine Prosa.
 *
 * Invariante, die diese Funktion traegt: Was `projektion.ts` beim Bauen der
 * `EingangsArgumente` NICHT liest, loest hier KEINE Berechnung aus. Aendert sich die
 * Menge der rechenrelevanten Felder (etwa weil `projektion.ts` ein neues Feld liest),
 * muss `RECHENIRRELEVANTE_FELDER` synchron nachgezogen werden.
 */
import type { Projekt } from '../../server/projekt-schema.js';

const RECHENIRRELEVANTE_FELDER = ['offertText', 'auftraggeber'] as const;

/**
 * Wahr, wenn sich `vorher` und `nachher` HOECHSTENS in den rechenirrelevanten Feldern
 * unterscheiden (inklusive Gleichheit). `false` heisst: mindestens ein
 * rechenrelevantes Feld hat sich geaendert (oder es ist der erste Vergleich) — dann
 * MUSS eine Berechnung folgen.
 */
export function nurRechenirrelevanteFelderGeaendert(vorher: Projekt, nachher: Projekt): boolean {
  const ohneIrrelevante = (p: Projekt): Omit<Projekt, typeof RECHENIRRELEVANTE_FELDER[number]> => {
    const kopie: Record<string, unknown> = { ...p };
    for (const feld of RECHENIRRELEVANTE_FELDER) delete kopie[feld];
    return kopie as Omit<Projekt, typeof RECHENIRRELEVANTE_FELDER[number]>;
  };
  return JSON.stringify(ohneIrrelevante(vorher)) === JSON.stringify(ohneIrrelevante(nachher));
}
