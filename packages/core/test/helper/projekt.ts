/**
 * Fixture-Aufbau ohne Zufall (Spec 03 §9, I-14).
 *
 * Der Plan P2 verwendet diese Datei durchgehend, definiert sie aber an keiner
 * Stelle; sie entsteht hier und waechst mit den Aufgaben mit. Alle Werte sind
 * feste Literale — kein `Date.now()`, kein `Math.random()`, keine Ableitung aus
 * der Umgebung; sonst waere der Determinismusnachweis (I-14) von der
 * Ausfuehrungszeit abhaengig.
 */
import type { Adresse } from '../../src/domain/adresse.js';
import { gewicht, quadratmeter, quadratmeterAbNull, rappen, score } from '../../src/domain/geld.js';
import { einheitId, faktorId, lagescoreName, liegenschaftId, wohnungsnummer, wohnungstypId } from '../../src/domain/ids.js';
import { erzeugeLiegenschaft, type Liegenschaft } from '../../src/domain/liegenschaft.js';
import type { ZuAbschlag } from '../../src/domain/zuabschlag.js';
import {
  bereiteEingabeAuf,
  type EingangsArgumente,
  type PipelineEingang,
} from '../../src/pipeline/stufe1-eingabe.js';
import type { VermarkterFaktoren } from '../../src/pipeline/beschaffer.js';
import {
  berechneVerkaufssumme,
  type VerkaufssummeErgebnis,
} from '../../src/pipeline/stufe2-verkaufssumme.js';
import {
  ergaenzeAbgeleiteteFaktoren,
  type GeschlossenerEingang,
} from '../../src/pipeline/stufe2a-abgeleitete.js';
import type { NormalisierungErgebnis } from '../../src/pipeline/stufe3-normalisierung.js';
import type { GewichtungErgebnis } from '../../src/pipeline/stufe4-gewichtung.js';
import type { FaktorId, LagescoreName } from '../../src/domain/ids.js';
import type { FaktorParameter, Konfiguration } from '../../src/config/typen.js';
import type { Rappen, Score } from '../../src/domain/geld.js';
import type { RepraesentativeParametrisierung } from '../../src/domain/wohnungstyp.js';
import type {
  Lagescores,
  LagescoreMeta,
  Referenzbewertung,
} from '../../src/ports/valuation-provider.js';

export function adresseFixture(): Adresse {
  return { strasse: 'Bahnhofstrasse', hausnummer: '1', plz: '6003', ort: 'Luzern' };
}

export const BEWERTUNGEN_STANDARD = {
  zustandsbewertungen: {
    bathrooms: 'well_maintained', kitchen: 'well_maintained',
    flooring: 'well_maintained', windows: 'well_maintained',
  },
  qualitaetsbewertungen: {
    bathrooms: 'normal', kitchen: 'normal', flooring: 'normal', windows: 'normal',
  },
} as const;

export function parametrisierungFixture(): RepraesentativeParametrisierung {
  return {
    flaecheInnen: quadratmeter(92.5),
    flaecheAussen: quadratmeterAbNull(0),
    stockwerk: 1,
    energielabel: 'B',
    zustandsbewertungen: BEWERTUNGEN_STANDARD.zustandsbewertungen,
    qualitaetsbewertungen: BEWERTUNGEN_STANDARD.qualitaetsbewertungen,
    anzahlBadezimmer: 1,
    lift: true,
    baujahr: 2025,
    heizungsart: 'heat_pump',
  };
}

/** Marktwert 850 000 CHF = 85 000 000 Rappen, unabhaengig vom Wohnungstyp. */
export function referenzbewertungFixture(id: string): Referenzbewertung {
  return {
    wohnungstypId: wohnungstypId(id),
    marktwert: rappen(85_000_000),
    bewertungsdatum: '2026-08-16',
    anbieter: 'PriceHubble',
    parametrisierungsAbdruck: parametrisierungFixture(),
    anzeige: {
      konfidenzbereich: { von: rappen(80_000_000), bis: rappen(90_000_000) },
      konfidenzklasse: 'good',
    },
  };
}

/** Die neun Lagescores bleiben getrennt gefuehrt (I-26); keine Verdichtung. */
export const LAGESCORE_FIXTURE_NAMEN: readonly string[] = [
  'location', 'family', 'health', 'leisure', 'shopping',
  'catering', 'view', 'noise', 'nuisance',
];

export function lagescoresFixture(
  ueberschreibungen: ReadonlyMap<LagescoreName, Score> = new Map(),
): Lagescores {
  const werte = new Map<LagescoreName, Score>();
  const meta = new Map<LagescoreName, LagescoreMeta>();
  // Einfuegen in Codepoint-Ordnung, nicht in der Reihenfolge der Anbieterdokumentation:
  // Die Serialisierung (PE-08) sortiert so, und nur wenn das Fixture dieselbe Ordnung
  // fuehrt, ist der Rundlauf reihenfolgegleich pruefbar (I-14).
  for (const name of [...LAGESCORE_FIXTURE_NAMEN].sort()) {
    const schluessel = lagescoreName(name);
    const wert = ueberschreibungen.get(schluessel) ?? score(0.5);
    werte.set(schluessel, wert);
    meta.set(schluessel, { originalScore: score(0.5), isOverridden: false });
  }
  return { werte, meta, abrufdatum: '2026-08-16', anbieter: 'PriceHubble' };
}

/**
 * Kernseitige Standardkonfiguration der Tests.
 *
 * Bewusst ein eigenes Literal und keine Ableitung aus `config/company-defaults.json`:
 * Der Kern darf das Dateisystem nicht lesen (R1), und die Testerwartungen des Plans
 * weichen an einer Stelle ab — die ordinale Skala des Innenausbaus fuehrt hier fuenf
 * Stufen, die ausgelieferte Standardkonfiguration sechs. Die Skala ist rein deskriptiv
 * (PE-05) und geht in keine Formel ein; die Abweichung beruehrt kein Rechenergebnis.
 */
export function standardKonfiguration(): Konfiguration {
  const faktoren = new Map<FaktorId, FaktorParameter>();
  faktoren.set(faktorId('lage_gesamt'), {
    grenzeMin: 1,
    grenzeMax: 0,
    gewicht: gewicht(0.4),
    strategie: 'min-max',
    quelle: 'lagescore',
    quellSchluessel: 'location',
    bezeichnung: 'Gesamtlage (PriceHubble-Lagescore)',
  });
  faktoren.set(faktorId('innenausbau_qualitaet'), {
    grenzeMin: 1,
    grenzeMax: 6,
    gewicht: gewicht(0.25),
    strategie: 'min-max',
    quelle: 'manuell',
    quellSchluessel: 'innenausbau_qualitaet',
    bezeichnung: 'Qualitaet des Innenausbaus',
    skala: {
      form: 'ordinal',
      stufen: [
        { wert: 1, bezeichnung: 'einfacher Standard' },
        { wert: 2, bezeichnung: 'Standard' },
        { wert: 3, bezeichnung: 'gehoben' },
        { wert: 4, bezeichnung: 'hochwertig' },
        { wert: 5, bezeichnung: 'exklusiv' },
      ],
    },
  });
  faktoren.set(faktorId('preissegment'), {
    grenzeMin: 600_000,
    grenzeMax: 1_800_000,
    gewicht: gewicht(0.2),
    strategie: 'min-max',
    quelle: 'abgeleitet',
    quellSchluessel: 'mittlererQuadratmeterpreis',
    bezeichnung: 'Preissegment (flaechengewichteter mittlerer Quadratmeterpreis)',
  });
  // Faktorschluessel `projektumfang`, Quellschluessel `einheitenzahl` (PE-03).
  faktoren.set(faktorId('projektumfang'), {
    grenzeMin: 4,
    grenzeMax: 36,
    gewicht: gewicht(0.15),
    strategie: 'min-max',
    quelle: 'abgeleitet',
    quellSchluessel: 'einheitenzahl',
    bezeichnung: 'Projektumfang (Anzahl Einheiten)',
  });

  return {
    meta: {
      schemaVersion: 1,
      konfigVersion: '1.0.0-vorlaeufig',
      gueltigAb: '2026-08-16',
      beschreibung: 'Testbasis des Kerns, entspricht der Standardkonfiguration aus Spec 02 §5.',
    },
    flaeche: { alpha: 0.5 },
    preisanpassung: {
      zMin: -0.25,
      zMax: 0.25,
      begruendungPflicht: true,
      begruendungMinLaenge: 10,
    },
    anpassungsVorlagen: [
      {
        id: 'attikalage',
        bezeichnung: 'Attikawohnung / Dachgeschoss',
        vorgabefaktor: 0.1,
        erfassungsform: 'relativ',
        begruendungVorschlag: 'Attikalage mit erhoehter Aussichtsqualitaet und privater Dachterrasse.',
      },
    ],
    merkmale: [],
    faktoren,
    honorar: {
      stuetzstellen: [
        { v: rappen(0), hMin: rappen(3_000_000), hMax: rappen(4_000_000) },
        { v: rappen(500_000_000), hMin: rappen(11_250_000), hMax: rappen(15_000_000) },
        { v: rappen(1_000_000_000), hMin: rappen(19_500_000), hMax: rappen(26_000_000) },
        { v: rappen(2_500_000_000), hMin: rappen(37_500_000), hMax: rappen(50_000_000) },
        { v: rappen(5_000_000_000), hMin: rappen(60_000_000), hMax: rappen(80_000_000) },
        { v: rappen(10_000_000_000), hMin: rappen(93_750_000), hMax: rappen(125_000_000) },
        { v: rappen(20_000_000_000), hMin: rappen(150_000_000), hMax: rappen(200_000_000) },
      ],
      skalierung: { form: 'linear', gMin: 0.85, gMax: 1.15 },
    },
    /**
     * Feste Testpruefsumme. Im Betrieb setzt der Lader in `apps/web` dieses Feld
     * (E-26, PE-04); der Kern bildet sie nicht. Hier steht ein Literal, damit der
     * Determinismusnachweis (I-14) nicht von einer Hashberechnung abhaengt.
     */
    konfigPruefsumme: '0'.repeat(63) + '1',
  };
}

/**
 * Liegenschaft mit einem Wohnungstyp (3.5 Zimmer) und vier Einheiten A-01..A-04.
 * Alle Einheiten tragen die Referenzflaechen und keine Anpassungen — damit ist die
 * Referenztreue I-05 an diesem Fixture unmittelbar pruefbar.
 */
export interface LiegenschaftFixtureOptionen {
  /** Anpassungen der ERSTEN Einheit (A-01); alle uebrigen bleiben ohne. */
  readonly anpassungenErsteEinheit?: readonly ZuAbschlag[];
  /** Setzt beide Referenzflaechen des Wohnungstyps auf null — provoziert S-04. */
  readonly referenzflaecheNull?: boolean;
  /** Aussenflaeche fuer Typ UND Einheiten zugleich, damit I-05 haelt. */
  readonly aussenflaeche?: number;
}

export function liegenschaftFixture(
  optionen: LiegenschaftFixtureOptionen = {},
): Liegenschaft {
  const aussen = optionen.aussenflaeche ?? 0;
  const basis = parametrisierungFixture();
  const typ = {
    id: wohnungstypId('T1'),
    zimmerzahl: 3.5,
    parametrisierung: optionen.referenzflaecheNull === true
      ? {
          ...basis,
          flaecheInnen: quadratmeterAbNull(0),
          flaecheAussen: quadratmeterAbNull(0),
        }
      : { ...basis, flaecheAussen: quadratmeterAbNull(aussen) },
  };
  const einheiten = ['A-01', 'A-02', 'A-03', 'A-04'].map((nummer, index) => ({
    id: einheitId(`E-${index + 1}`),
    wohnungsnummer: wohnungsnummer(nummer),
    wohnungstypId: typ.id,
    flaecheInnen: quadratmeter(92.5),
    flaecheAussen: quadratmeterAbNull(aussen),
    anpassungen: index === 0 ? optionen.anpassungenErsteEinheit ?? [] : [],
  }));
  const erzeugt = erzeugeLiegenschaft({
    id: liegenschaftId('L-1'),
    adresse: adresseFixture(),
    wohnungstypen: [typ],
    einheiten,
  });
  if (!erzeugt.ok) throw new Error('Fixture-Liegenschaft ist ungueltig');
  return erzeugt.wert;
}

export interface EingangsFixtureOptionen extends LiegenschaftFixtureOptionen {
  readonly liegenschaft?: Liegenschaft;
  /** Ueberschreibt `flaeche.alpha` der Standardkonfiguration. */
  readonly alpha?: number;
  readonly bewertungen?: readonly Referenzbewertung[];
  readonly lagescores?: Lagescores;
  readonly vermarkterFaktoren?: VermarkterFaktoren;
  readonly konfiguration?: Konfiguration;
  readonly zeitstempel?: string;
  /** Kurzname fuer `bewertungsbuendelVollstaendig` (US-15). */
  readonly vollstaendig?: boolean;
}

export function eingangsArgumente(
  optionen: EingangsFixtureOptionen = {},
): EingangsArgumente {
  const liegenschaft = optionen.liegenschaft ?? liegenschaftFixture(optionen);
  const bewertungen = optionen.bewertungen ?? [referenzbewertungFixture('T1')];
  /**
   * Ohne ausdrueckliche Angabe wird die Vollstaendigkeit aus den Daten abgeleitet,
   * nicht auf `true` gesetzt: Ein Buendel, dem eine Bewertung fehlt, IST
   * unvollstaendig. Eine feste Vorgabe `true` liesse ein Fixture behaupten, der
   * Abruf sei vollstaendig gewesen, waehrend ihm Bewertungen fehlen — genau die
   * Aussage, die US-15 und I-24 unterbinden sollen.
   */
  const abgedeckt = new Set(bewertungen.map((b) => b.wohnungstypId as string));
  return {
    liegenschaft,
    bewertungen,
    bewertungsbuendelVollstaendig:
      optionen.vollstaendig ?? liegenschaft.wohnungstypen.every((t) => abgedeckt.has(t.id)),
    lagescores: optionen.lagescores
      ?? lagescoresFixture(new Map([[lagescoreName('location'), score(0.8)]])),
    vermarkterFaktoren: optionen.vermarkterFaktoren
      ?? { werte: new Map([[faktorId('innenausbau_qualitaet'), 3]]) },
    konfiguration: optionen.konfiguration ?? (
      optionen.alpha === undefined
        ? standardKonfiguration()
        : { ...standardKonfiguration(), flaeche: { alpha: optionen.alpha } }
    ),
    zeitstempel: optionen.zeitstempel ?? '2026-08-16T10:00:00.000Z',
  };
}

/** Stufe-1-Ergebnis des Standardfixtures; Eingang der Stufen 2 und folgende. */
export function pipelineEingang(optionen: EingangsFixtureOptionen = {}): PipelineEingang {
  const r = bereiteEingabeAuf(eingangsArgumente(optionen));
  if (!r.ok) throw new Error(`Stufe 1 des Fixtures schlug fehl: ${r.fehler.code}`);
  return r.wert;
}

/**
 * Stufe 2 des Standardfixtures.
 *
 * Zwei Aufrufformen, weil die Stufen 2a und 5 Verschiedenes brauchen: Mit
 * Fixture-Optionen entsteht das echte Stufe-2-Ergebnis samt Positionen; mit einer
 * blossen Verkaufssumme entsteht ein Traeger, der nur `V` fuehrt. Stufe 5 liest
 * ausschliesslich `verkaufssumme` — ein echtes Projekt zu konstruieren, das eine
 * bestimmte Verkaufssumme trifft, waere Umweg ohne Erkenntnisgewinn und wuerde die
 * Stufe-5-Erwartungen von der Preisableitung abhaengig machen.
 */
export function verkaufssummeErgebnis(
  eingabe: EingangsFixtureOptionen | Rappen = {},
): VerkaufssummeErgebnis {
  if (typeof eingabe === 'number') {
    return {
      typAbleitungen: [],
      positionen: [],
      verkaufssumme: eingabe,
      einheitenzahl: 0,
      alpha: 0.5,
    };
  }
  const r = berechneVerkaufssumme(pipelineEingang(eingabe));
  if (!r.ok) throw new Error(`Stufe 2 des Fixtures schlug fehl: ${r.fehler.code}`);
  return r.wert;
}

/** Gewichtungsergebnis mit unmittelbar gesetztem Aufwandindikator D. */
export function gewichtungErgebnis(d: number): GewichtungErgebnis {
  return { beitraege: [], gewichtssumme: 1, aufwandindikator: d };
}

/** Eingang nach dem Zwischenschritt 4.2a; einzige zulaessige Eingabe von Stufe 3. */
export function geschlossenerEingang(
  optionen: EingangsFixtureOptionen = {},
): GeschlossenerEingang {
  const eingang = pipelineEingang(optionen);
  const verkauf = berechneVerkaufssumme(eingang);
  if (!verkauf.ok) throw new Error(`Stufe 2 des Fixtures schlug fehl: ${verkauf.fehler.code}`);
  const r = ergaenzeAbgeleiteteFaktoren(eingang, verkauf.wert);
  if (!r.ok) throw new Error(`Zwischenschritt des Fixtures schlug fehl: ${r.fehler.code}`);
  return r.wert;
}

/**
 * Normalisierungsergebnis mit frei gesetzten normierten Werten.
 *
 * Die Werte werden direkt gesetzt statt ueber Stufe 3 erzeugt: Die Stufe-4-Tests pruefen
 * die Gewichtung, und ein Umweg ueber die Normalisierung machte ihre Erwartungswerte von
 * den Faktorgrenzen abhaengig — ein Fehler in Stufe 3 wuerde dann als Fehler in Stufe 4
 * erscheinen.
 */
export function normalisierungErgebnis(
  normierte: Readonly<Record<string, number>>,
): NormalisierungErgebnis {
  const faktoren = Object.entries(normierte)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, wert]) => ({
      faktorId: faktorId(name),
      rohwert: wert,
      grenzeMin: 0,
      grenzeMax: 1,
      strategie: 'min-max' as const,
      gekappt: false,
      normiert: score(wert),
    }));
  return { faktoren };
}

/** Struktur der Szenario-Fixtures aus `test/fixtures/scenarios/` (Spec 06 §3). */
export interface SzenarioFixture {
  readonly szenario_id: string;
  readonly bezeichnung: string;
  readonly lage: { readonly adresse: string; readonly plz: string; readonly ort: string };
  readonly wohnungstypen: readonly {
    readonly typ_id: string; readonly zimmer: number; readonly A_ref_innen: number;
    readonly A_ref_aussen: number; readonly P_ref_rappen?: number }[];
  readonly einheiten: readonly {
    readonly unit_id: string; readonly typ_id: string; readonly A_innen: number;
    readonly A_aussen: number;
    readonly anpassungen: readonly { readonly a_i: number; readonly begruendung: string }[] }[];
  readonly lagescores: Readonly<Record<string, number>>;
  readonly aufwandfaktoren: Readonly<Record<string, number>>;
  readonly konfig_ref: string;
  readonly erwartung_ref: string;
  readonly lagedaten_herkunft: 'synthetisch' | 'aufgezeichnet';
  readonly zeitstempel: string;
}

/**
 * Bildet ein Szenario-Fixture auf die Berechnungseingabe ab.
 *
 * Ein Wohnungstyp ohne `P_ref_rappen` erhaelt bewusst KEINE Referenzbewertung: Genau so
 * sieht ein Abruf aus, der fuer diesen Typ nichts geliefert hat (S5). Ein Ersatzwert
 * waere hier die naheliegende und nach I-24 verbotene Abkuerzung.
 */
export function szenarioZuEingangsArgumenten(fixture: SzenarioFixture): EingangsArgumente {
  const teile = fixture.lage.adresse.split(' ');
  const hausnummer = teile.length > 1 ? teile[teile.length - 1]! : '1';
  const strasse = teile.length > 1 ? teile.slice(0, -1).join(' ') : fixture.lage.adresse;

  const wohnungstypen = fixture.wohnungstypen.map((t) => ({
    id: wohnungstypId(t.typ_id),
    zimmerzahl: t.zimmer,
    parametrisierung: {
      ...parametrisierungFixture(),
      flaecheInnen: quadratmeter(t.A_ref_innen),
      flaecheAussen: quadratmeterAbNull(t.A_ref_aussen),
    },
  }));

  const erzeugt = erzeugeLiegenschaft({
    id: liegenschaftId(fixture.szenario_id),
    adresse: { strasse, hausnummer, plz: fixture.lage.plz, ort: fixture.lage.ort },
    wohnungstypen,
    einheiten: fixture.einheiten.map((e, index) => ({
      id: einheitId(`E-${index + 1}`),
      wohnungsnummer: wohnungsnummer(e.unit_id),
      wohnungstypId: wohnungstypId(e.typ_id),
      flaecheInnen: quadratmeter(e.A_innen),
      flaecheAussen: quadratmeterAbNull(e.A_aussen),
      anpassungen: e.anpassungen.map((a) => ({
        faktor: a.a_i, begruendung: a.begruendung, erfassungsform: 'relativ' as const,
      })),
    })),
  });
  if (!erzeugt.ok) {
    throw new Error(`Szenario ${fixture.szenario_id} ergibt kein gueltiges Aggregat`);
  }

  const bewertungen = fixture.wohnungstypen
    .filter((t) => t.P_ref_rappen !== undefined)
    .map((t) => ({
      ...referenzbewertungFixture(t.typ_id),
      marktwert: rappen(t.P_ref_rappen!),
      parametrisierungsAbdruck: {
        ...parametrisierungFixture(),
        flaecheInnen: quadratmeter(t.A_ref_innen),
        flaecheAussen: quadratmeterAbNull(t.A_ref_aussen),
      },
    }));

  const ueberschreibungen = new Map(
    Object.entries(fixture.lagescores).map(([name, wert]) => [lagescoreName(name), score(wert)]),
  );
  const vermarkterFaktoren = {
    werte: new Map(
      Object.entries(fixture.aufwandfaktoren).map(([name, wert]) => [faktorId(name), wert]),
    ),
  };

  return {
    liegenschaft: erzeugt.wert,
    bewertungen,
    bewertungsbuendelVollstaendig:
      bewertungen.length === fixture.wohnungstypen.length,
    lagescores: lagescoresFixture(ueberschreibungen),
    vermarkterFaktoren,
    konfiguration: standardKonfiguration(),
    zeitstempel: fixture.zeitstempel,
  };
}
