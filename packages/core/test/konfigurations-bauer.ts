/**
 * Objektbauer fuer Konfigurationstests. Liegt bewusst unter test/ und nicht
 * unter src/, damit eine Anpassung im Erweiterungsszenario nicht in den
 * Codefilter der Erweiterbarkeitsmessung faellt.
 *
 * Betraege in Rappen, Preissegment-Grenzen in Rappen je Quadratmeter (E-07).
 */
import type { RohKonfiguration } from '../src/config/schema.js';

export const BASIS_KONFIGURATION: RohKonfiguration = {
  meta: {
    schemaVersion: 1,
    konfigVersion: '1.0.0-vorlaeufig',
    gueltigAb: '2026-08-16',
    beschreibung: 'Testbasis, entspricht der Standardkonfiguration aus Spec 02 §5.',
  },
  flaeche: { alpha: 0.5 },
  preisanpassung: {
    zMin: -0.25,
    zMax: 0.25,
    begruendungPflicht: true,
    begruendungMinLaenge: 10,
  },
  merkmale: [],
  anpassungsVorlagen: [
    {
      id: 'attikalage',
      bezeichnung: 'Attikawohnung / Dachgeschoss',
      vorgabefaktor: 0.1,
      erfassungsform: 'relativ',
      begruendungVorschlag: 'Attikalage mit erhoehter Aussichtsqualitaet und privater Dachterrasse.',
    },
  ],
  aufwandfaktoren: {
    lage_gesamt: {
      bezeichnung: 'Gesamtlage (PriceHubble-Lagescore)',
      quelle: 'lagescore',
      quellSchluessel: 'location',
      strategie: 'minmax',
      min: 1,
      max: 0,
      gewicht: 0.4,
    },
    innenausbau_qualitaet: {
      bezeichnung: 'Qualitaet des Innenausbaus',
      quelle: 'manuell',
      quellSchluessel: 'innenausbau_qualitaet',
      strategie: 'minmax',
      min: 1,
      max: 6,
      gewicht: 0.25,
    },
    preissegment: {
      bezeichnung: 'Preissegment',
      quelle: 'abgeleitet',
      quellSchluessel: 'mittlererQuadratmeterpreis',
      strategie: 'minmax',
      min: 600000,
      max: 1800000,
      gewicht: 0.2,
    },
    // Faktorschluessel `projektumfang`, Quellschluessel `einheitenzahl` (PE-03).
    projektumfang: {
      bezeichnung: 'Projektumfang',
      quelle: 'abgeleitet',
      quellSchluessel: 'einheitenzahl',
      strategie: 'minmax',
      min: 4,
      max: 36,
      gewicht: 0.15,
    },
  },
  honorar: {
    stuetzstellen: [
      { v: 0, hMin: 3000000, hMax: 4000000 },
      { v: 500000000, hMin: 11250000, hMax: 15000000 },
      { v: 1000000000, hMin: 19500000, hMax: 26000000 },
      { v: 2500000000, hMin: 37500000, hMax: 50000000 },
      { v: 5000000000, hMin: 60000000, hMax: 80000000 },
      { v: 10000000000, hMin: 93750000, hMax: 125000000 },
      { v: 20000000000, hMin: 150000000, hMax: 200000000 },
    ],
    skalierung: { form: 'linear', gMin: 0.85, gMax: 1.15 },
  },
  dossierDefaults: {
    zustandsbewertungen: {
      bathrooms: 'new_or_recently_renovated',
      kitchen: 'new_or_recently_renovated',
      flooring: 'new_or_recently_renovated',
      windows: 'new_or_recently_renovated',
    },
    qualitaetsbewertungen: {
      bathrooms: 'high_quality',
      kitchen: 'high_quality',
      flooring: 'high_quality',
      windows: 'high_quality',
    },
  },
  api: {
    baseUrl: 'https://api.pricehubble.com',
    endpunkte: {
      login: '/auth/login/credentials',
      dossierGet: '/api/v1/dossiers/{dossierId}',
      dossierUpdate: '/api/v1/dossiers/{dossierId}',
      dossierValuation: '/api/v1/dossiers/{dossierId}/valuation',
      locationScores: '/api/v1/location/scores',
    },
    timeoutMs: 10000,
    timeoutValuationMs: 20000,
    gesamtbudgetMs: 45000,
    retry: {
      maxVersuche: 3,
      startBackoffMs: 500,
      backoffFaktor: 2,
      maxBackoffMs: 8000,
      jitter: 'voll',
      retryAfterBeachten: true,
      retryAfterMaxSekunden: 60,
      retryStatuscodes: [429, 500, 502, 503, 504],
    },
    tokenGueltigkeitMin: 720,
    tokenSicherheitsmargeMin: 30,
  },
};

export function baueKonfiguration(
  mutation: (konfiguration: RohKonfiguration) => void,
): RohKonfiguration {
  const kopie = structuredClone(BASIS_KONFIGURATION);
  mutation(kopie);
  return kopie;
}
