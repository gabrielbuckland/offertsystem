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
import { faktorId, lagescoreName, wohnungstypId } from '../../src/domain/ids.js';
import type { FaktorId, LagescoreName } from '../../src/domain/ids.js';
import type { FaktorParameter, Konfiguration } from '../../src/config/typen.js';
import type { Score } from '../../src/domain/geld.js';
import type { RepraesentativeParametrisierung } from '../../src/domain/wohnungstyp.js';
import type {
  Lagescores,
  LagescoreMeta,
  Referenzbewertung,
} from '../../src/ports/valuation-provider.js';

export function adresseFixture(): Adresse {
  return { strasse: 'Bahnhofstrasse', hausnummer: '1', plz: '6003', ort: 'Luzern' };
}

export function parametrisierungFixture(): RepraesentativeParametrisierung {
  return {
    flaecheInnen: quadratmeter(92.5),
    flaecheAussen: quadratmeterAbNull(0),
    stockwerk: 1,
    energielabel: 'B',
    zustandsbewertungen: { bathrooms: 'well_maintained' },
    qualitaetsbewertungen: { bathrooms: 'normal' },
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
  for (const name of LAGESCORE_FIXTURE_NAMEN) {
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
        begruendungVorschlag: 'Attikalage mit erhoehter Aussichtsqualitaet und privater Dachterrasse.',
      },
    ],
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
  };
}
