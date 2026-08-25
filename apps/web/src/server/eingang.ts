/**
 * Keine Formel. Beschaffung und Bau der `EingangsArgumente` (PE-22, PE-23, I-02).
 *
 * Reihenfolge nach Spec 04 §3.1: erst die Lagescores der Projektadresse (einmal je
 * Liegenschaft), dann die Bewertungen je Wohnungstyp. Beides VOR dem Pipeline-Start —
 * `EingangsArgumente.lagescores` ist Pflichtfeld, und Stufe 2a leitet daraus Faktoren ab.
 *
 * Der einzige Ort, an dem `EingangsArgumente` entstehen. `Liegenschaft` wird
 * ausschliesslich ueber `erzeugeLiegenschaft` konstruiert (I-02); eine direkte
 * Objektliteral-Konstruktion umginge die Aggregatinvarianten.
 */
import {
  erzeugeLiegenschaft,
  type BewertungsAnfrage,
  type BewertungsBuendel,
  type EingangsArgumente,
  type EinheitId,
  type FaktorId,
  type Konfiguration,
  type Lagescores,
  type LiegenschaftEntwurf,
  type LiegenschaftId,
  type Quadratmeter,
  type Rappen,
  type ValuationProvider,
  type WohnungstypId,
  type Wohnungsnummer,
  type ZuAbschlag,
} from '@offert/core';
import type { Erfassung } from './erfassung-schema.js';
import { uebersetzeAggregatFehler, uebersetzeProviderFehler } from './fehlertexte.js';

export type Ergebnis<T> =
  | { readonly ok: true; readonly wert: T }
  | { readonly ok: false; readonly meldung: string };

export interface Beschafft {
  readonly buendel: BewertungsBuendel;
  readonly lagescores: Lagescores;
}

export function anfragenAus(erfassung: Erfassung): readonly BewertungsAnfrage[] {
  return erfassung.wohnungstypen.map((t) => ({
    adresse: erfassung.liegenschaft.adresse,
    wohnungstypId: t.id as WohnungstypId,
    zimmerzahl: t.zimmerzahl,
    parametrisierung: t.parametrisierung as BewertungsAnfrage['parametrisierung'],
  }));
}

export async function beschaffe(
  erfassung: Erfassung, provider: ValuationProvider,
): Promise<Ergebnis<Beschafft>> {
  const lagescores = await provider.holeLagescores(erfassung.liegenschaft.adresse);
  if (!lagescores.ok) {
    return { ok: false, meldung: uebersetzeProviderFehler(lagescores.fehler).text };
  }
  const buendel = await provider.bewerteWohnungstypen(anfragenAus(erfassung));
  if (!buendel.ok) {
    return { ok: false, meldung: uebersetzeProviderFehler(buendel.fehler).text };
  }
  return { ok: true, wert: { buendel: buendel.wert, lagescores: lagescores.wert } };
}

/**
 * Eigene Funktion statt eines Objektliterals mit bedingtem Spread: Unter
 * `exactOptionalPropertyTypes` traegt ein bedingter Spread den Typ `T | undefined`,
 * und `ZuAbschlag` laesst fuer die optionalen Felder kein `undefined` zu.
 */
function zuAbschlag(a: Erfassung['einheiten'][number]['anpassungen'][number]): ZuAbschlag {
  const basis = {
    faktor: a.faktor,
    begruendung: a.begruendung,
    erfassungsform: a.erfassungsform,
  };
  if (a.erfassterBetrag !== undefined && a.vorlageId !== undefined) {
    return { ...basis, erfassterBetrag: a.erfassterBetrag as Rappen, vorlageId: a.vorlageId };
  }
  if (a.erfassterBetrag !== undefined) {
    return { ...basis, erfassterBetrag: a.erfassterBetrag as Rappen };
  }
  if (a.vorlageId !== undefined) {
    return { ...basis, vorlageId: a.vorlageId };
  }
  return basis;
}

function entwurfAus(
  erfassung: Erfassung, optionen: { ohneAnpassungen?: boolean },
): LiegenschaftEntwurf {
  return {
    id: `L-${erfassung.projekt.projektId}` as LiegenschaftId,
    adresse: erfassung.liegenschaft.adresse,
    wohnungstypen: erfassung.wohnungstypen.map((t) => ({
      id: t.id as WohnungstypId,
      zimmerzahl: t.zimmerzahl,
      parametrisierung: t.parametrisierung as BewertungsAnfrage['parametrisierung'],
    })),
    einheiten: erfassung.einheiten.map((e) => ({
      id: `E-${e.wohnungsnummer}` as EinheitId,
      wohnungsnummer: e.wohnungsnummer as Wohnungsnummer,
      wohnungstypId: e.wohnungstypId as WohnungstypId,
      flaecheInnen: e.flaecheInnen as Quadratmeter,
      flaecheAussen: e.flaecheAussen as Quadratmeter,
      // `ohneAnpassungen` dient der Basispreisermittlung (PE-21): b_j ist gerade die
      // Groesse VOR den Anpassungen.
      anpassungen: optionen.ohneAnpassungen === true ? [] : e.anpassungen.map(zuAbschlag),
    })),
  };
}

export function zuEingangsArgumenten(
  erfassung: Erfassung,
  beschafft: Beschafft,
  konfiguration: Konfiguration,
  zeitstempel: string,
  optionen: { ohneAnpassungen?: boolean } = {},
): Ergebnis<EingangsArgumente> {
  const aggregat = erzeugeLiegenschaft(entwurfAus(erfassung, optionen));
  if (!aggregat.ok) return { ok: false, meldung: uebersetzeAggregatFehler(aggregat.fehler) };
  return {
    ok: true,
    wert: {
      liegenschaft: aggregat.wert,
      bewertungen: [...beschafft.buendel.bewertungen.values()],
      bewertungsbuendelVollstaendig: beschafft.buendel.vollstaendig, // PE-23
      lagescores: beschafft.lagescores, // PE-22
      vermarkterFaktoren: {
        werte: new Map(
          Object.entries(erfassung.aufwandfaktoren).map(([id, wert]) => [id as FaktorId, wert]),
        ),
      },
      konfiguration,
      zeitstempel,
    },
  };
}
