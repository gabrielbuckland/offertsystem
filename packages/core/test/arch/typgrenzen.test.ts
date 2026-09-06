/**
 * Typgrenzen (I-28, E-21).
 *
 * Bewusst kein zweiter Typpruefer (etwa `expectTypeOf` mit `vitest --typecheck`)
 * neben `tsc --build` — das brachte die Moeglichkeit, dass beide auseinanderlaufen.
 * Hier stehen dieselben Zusagen als `@ts-expect-error`-Behauptungen in einer
 * gewoehnlichen Datei: Sie liegen unter
 * `test/**` und damit im `include` der Paketkonfiguration, laufen also in
 * `npm run typecheck` mit. Faellt eine Grenze, bricht die Uebersetzung — und zwar
 * in derselben Kette, die auch den Produktivcode prueft.
 *
 * `@ts-expect-error` ist hier die schaerfere Form: Die Zeile ist ein Fehler, wenn
 * die erwartete Verletzung AUSBLEIBT. Eine versehentlich zulaessig gewordene
 * Zuweisung faellt damit auf, statt stillschweigend durchzugehen.
 */
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

/** Wahr, wenn die Schluesselmengen disjunkt sind. */
type Disjunkt<A extends string, B extends string> =
  Extract<A, B> extends never ? true : false;

const schluesselDisjunkt: Disjunkt<EingangSchluessel, AnzeigeSchluessel> = true;

describe('Typgrenzen (Uebersetzungszeit)', () => {
  it('haelt die Marken auseinander und die Anzeige aus dem Eingang heraus', () => {
    // Die eigentliche Zusage steht oben und wird von `tsc` geprueft. Dieser Fall
    // haelt die Werte in Gebrauch, damit `noUnusedLocals` sie nicht entfernt, und
    // macht die Pruefung im Testbericht sichtbar.
    expect(scoreAusBetrag).toBe(85_000_000);
    expect(betragAusScore).toBe(0.5);
    expect(schluesselDisjunkt).toBe(true);
    // `NichtVorhanden` ist ein Fehlertyp und damit `any`; er wird hier nur benannt,
    // damit die `@ts-expect-error`-Zeile oben nicht als ungenutzt gilt.
    expect<NichtVorhanden>(undefined).toBeUndefined();
  });
});
