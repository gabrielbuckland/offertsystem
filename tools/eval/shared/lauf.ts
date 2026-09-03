/**
 * Keine eigene Modellformel; der Lauf ruft ausschliesslich den Kern.
 *
 * Die Umsetzung Szenario -> `EingangsArgumente` steht hier und nicht in den Testhelfern
 * des Kerns: `tools/eval` haengt nach Spec 06 §7 nur von `packages/core/src` ab, nicht von
 * dessen Testbaum. Der Unterschied zur Testfassung ist bewusst: Hier wird die
 * Konfiguration UEBERGEBEN, weil die Werkzeuge gerade Varianten davon rechnen.
 */
import {
  berechne,
  erzeugeLiegenschaft,
  quadratmeter,
  rappen,
  score,
} from '../../../packages/core/src/index.ts';
import type {
  EingangsArgumente,
  EinheitId,
  FaktorId,
  Konfiguration,
  LagescoreName,
  Lagescores,
  LiegenschaftId,
  Referenzbewertung,
  RepraesentativeParametrisierung,
  WohnungstypId,
  Wohnungsnummer,
} from '../../../packages/core/src/index.ts';
import type { Szenario, SzenarioTyp } from './szenario.ts';

/**
 * Fester Zeitstempel als Rueckfall: E-29 verlangt hereingereichte Bezeichner und
 * Zeitpunkte, sonst waere I-14 nicht beobachtbar. Die Fixtures fuehren ihn selbst.
 */
export const EVAL_ZEITSTEMPEL = '2026-01-01T00:00:00.000Z';

// Lokal statt aus apps/web/test importiert: tools/ steht ausserhalb der Abhaengigkeitsmatrix,
// soll aber nicht in den Testbaum einer App greifen.
const BEWERTUNGEN_STANDARD = {
  zustandsbewertungen: {
    bathrooms: 'well_maintained', kitchen: 'well_maintained',
    flooring: 'well_maintained', windows: 'well_maintained',
  },
  qualitaetsbewertungen: {
    bathrooms: 'normal', kitchen: 'normal', flooring: 'normal', windows: 'normal',
  },
} as const;

export interface LaufErgebnis {
  readonly szenario_id: string;
  readonly ok: boolean;
  readonly fehlercode: string | null;
  readonly v_rappen: number | null;
  readonly einheitenzahl: number | null;
  readonly d: number | null;
  readonly g_von_d: number | null;
  readonly hmin_rappen: number | null;
  readonly hmax_rappen: number | null;
  readonly stufenindex: number | null;
  readonly lagedaten_herkunft: string;
}

function parametrisierung(typ: SzenarioTyp): RepraesentativeParametrisierung {
  return {
    flaecheInnen: quadratmeter(typ.A_ref_innen),
    flaecheAussen: typ.A_ref_aussen as RepraesentativeParametrisierung['flaecheAussen'],
    stockwerk: 1,
    energielabel: 'minergie_eco',
    ...BEWERTUNGEN_STANDARD,
    anzahlBadezimmer: 1,
    lift: false,
    baujahr: 2025,
    heizungsart: 'heat_pump_air',
  };
}

function lagescoresAus(szenario: Szenario): Lagescores {
  return {
    werte: new Map(
      Object.entries(szenario.lagescores).map(([n, w]) => [n as LagescoreName, score(w)]),
    ),
    meta: new Map(),
    abrufdatum: szenario.zeitstempel,
    anbieter: 'fixture',
  };
}

export type EingangErgebnis =
  | { readonly ok: true; readonly argumente: EingangsArgumente }
  | { readonly ok: false; readonly code: string };

export function baueEingang(szenario: Szenario, konfiguration: Konfiguration): EingangErgebnis {
  const teile = szenario.lage.adresse.split(' ');
  const hausnummer = teile.length > 1 ? teile[teile.length - 1]! : '1';
  const strasse = teile.length > 1 ? teile.slice(0, -1).join(' ') : szenario.lage.adresse;

  const erzeugt = erzeugeLiegenschaft({
    id: szenario.szenario_id as LiegenschaftId,
    adresse: { strasse, hausnummer, plz: szenario.lage.plz, ort: szenario.lage.ort },
    wohnungstypen: szenario.wohnungstypen.map((t) => ({
      id: t.typ_id as WohnungstypId,
      zimmerzahl: t.zimmer,
      parametrisierung: parametrisierung(t),
    })),
    einheiten: szenario.einheiten.map((e, index) => ({
      id: `E-${index + 1}` as EinheitId,
      wohnungsnummer: e.unit_id as Wohnungsnummer,
      wohnungstypId: e.typ_id as WohnungstypId,
      flaecheInnen: quadratmeter(e.A_innen),
      flaecheAussen: e.A_aussen as RepraesentativeParametrisierung['flaecheAussen'],
      anpassungen: e.anpassungen.map((a) => ({
        faktor: a.a_i, begruendung: a.begruendung, erfassungsform: 'relativ' as const,
      })),
    })),
  });
  if (!erzeugt.ok) {
    return { ok: false, code: erzeugt.fehler[0]?.code ?? 'EINGABE_UNGUELTIG' };
  }

  const bewertungen: readonly Referenzbewertung[] = szenario.wohnungstypen
    .filter((t) => t.P_ref_rappen !== null && t.P_ref_rappen !== undefined)
    .map((t) => ({
      wohnungstypId: t.typ_id as WohnungstypId,
      marktwert: rappen(t.P_ref_rappen as number),
      bewertungsdatum: szenario.zeitstempel.slice(0, 10),
      anbieter: 'fixture',
      parametrisierungsAbdruck: parametrisierung(t),
      anzeige: {
        konfidenzbereich: {
          von: rappen(Math.trunc((t.P_ref_rappen as number) * 0.94)),
          bis: rappen(Math.trunc((t.P_ref_rappen as number) * 1.06)),
        },
        konfidenzklasse: 'medium' as const,
      },
    }));

  return {
    ok: true,
    argumente: {
      liegenschaft: erzeugt.wert,
      bewertungen,
      bewertungsbuendelVollstaendig: bewertungen.length === szenario.wohnungstypen.length,
      lagescores: lagescoresAus(szenario),
      vermarkterFaktoren: {
        werte: new Map(
          Object.entries(szenario.aufwandfaktoren).map(([n, w]) => [n as FaktorId, w]),
        ),
      },
      konfiguration,
      zeitstempel: szenario.zeitstempel === '' ? EVAL_ZEITSTEMPEL : szenario.zeitstempel,
    },
  };
}

export function fuehreAus(szenario: Szenario, konfiguration: Konfiguration): LaufErgebnis {
  const leer = {
    szenario_id: szenario.szenario_id,
    v_rappen: null, einheitenzahl: null, d: null, g_von_d: null,
    hmin_rappen: null, hmax_rappen: null, stufenindex: null,
    lagedaten_herkunft: szenario.lagedaten_herkunft,
  };
  const eingang = baueEingang(szenario, konfiguration);
  if (!eingang.ok) return { ...leer, ok: false, fehlercode: eingang.code };

  const ergebnis = berechne(eingang.argumente);
  if (!ergebnis.ok) return { ...leer, ok: false, fehlercode: ergebnis.fehler.code };

  const w = ergebnis.wert;
  return {
    szenario_id: szenario.szenario_id,
    ok: true,
    fehlercode: null,
    v_rappen: w.verkaufssumme.verkaufssumme,
    einheitenzahl: w.verkaufssumme.einheitenzahl,
    d: w.gewichtung.aufwandindikator,
    g_von_d: w.honorar.skalierung,
    hmin_rappen: w.honorar.honorarMin,
    hmax_rappen: w.honorar.honorarMax,
    stufenindex: w.honorar.stufenindex,
    lagedaten_herkunft: szenario.lagedaten_herkunft,
  };
}
