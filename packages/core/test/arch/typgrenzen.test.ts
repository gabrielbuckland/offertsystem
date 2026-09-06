// Typgrenzen (I-28, E-21). Bewusst kein zweiter Typpruefer neben `tsc --build`:
// Die `@ts-expect-error`-Zeilen liegen in test/** und laufen damit in
// `npm run typecheck` mit — faellt eine Grenze, bricht dieselbe Kette, die auch
// den Produktivcode prueft. `@ts-expect-error` ist die schaerfere Form: Ein Fehler
// entsteht, wenn die erwartete Verletzung AUSBLEIBT, nicht wenn sie eintritt.
import { describe, expect, it } from 'vitest';
import { rappen, score, type Rappen, type Score } from '../../src/domain/geld.js';
import type { PipelineEingang } from '../../src/pipeline/stufe1-eingabe.js';
import type { BewertungsAnzeige } from '../../src/ports/valuation-provider.js';

// --- I-28: Rappen und Score sind nicht ineinander zuweisbar ---------------------
const einBetrag: Rappen = rappen(85_000_000);
const einScore: Score = score(0.5);

// @ts-expect-error I-28: Ein Frankenbetrag darf nicht als Score durchgehen.
const scoreAusBetrag: Score = einBetrag;
// @ts-expect-error I-28: Ein Score darf nicht als Rappenbetrag durchgehen.
const betragAusScore: Rappen = einScore;

// --- E-21: die Anzeigeinformation erreicht den Pipeline-Eingang nicht -----------
type EingangSchluessel = keyof PipelineEingang;
type AnzeigeSchluessel = keyof BewertungsAnzeige;

// @ts-expect-error E-21: `PipelineEingang` fuehrt kein Feld `anzeige`.
type NichtVorhanden = PipelineEingang['anzeige'];

type Disjunkt<A extends string, B extends string> =
  Extract<A, B> extends never ? true : false;

const schluesselDisjunkt: Disjunkt<EingangSchluessel, AnzeigeSchluessel> = true;

describe('Typgrenzen (Uebersetzungszeit)', () => {
  it('haelt die Marken auseinander und die Anzeige aus dem Eingang heraus', () => {
    // Haelt die Werte in Gebrauch, damit `noUnusedLocals` sie nicht entfernt.
    expect(scoreAusBetrag).toBe(85_000_000);
    expect(betragAusScore).toBe(0.5);
    expect(schluesselDisjunkt).toBe(true);
    expect<NichtVorhanden>(undefined).toBeUndefined();
  });
});
