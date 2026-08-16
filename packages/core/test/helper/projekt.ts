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
import { quadratmeter, quadratmeterAbNull, rappen, score } from '../../src/domain/geld.js';
import { lagescoreName, wohnungstypId } from '../../src/domain/ids.js';
import type { LagescoreName } from '../../src/domain/ids.js';
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
