/**
 * Deterministisches Offert-Objekt fuer die Tests dieses Pakets.
 *
 * Saemtliche Bezeichner und Zeitstempel sind literal fixiert: Nach E-29 werden sie in
 * Testlaeufen aus dem Fixture UEBERNOMMEN und nicht erzeugt — mit `new Date()` oder
 * `randomUUID()` waere I-14 (Reproduzierbarkeit) nicht beobachtbar, weil sich zwei
 * Laeufe schon in den Metadaten unterschieden.
 *
 * Der Bauer liefert bei jedem Aufruf eine frische Tiefkopie: Die Tests veraendern
 * einzelne Felder, um Zurueckweisungen zu belegen, und duerfen sich dabei nicht
 * gegenseitig beeinflussen.
 */
import type { Offer } from '../../src/model/offer.js';

/** Tief veraenderbare Fassung; das Schema selbst fuehrt alles `readonly`. */
export type Veraenderbar<T> = T extends readonly (infer U)[]
  ? Veraenderbar<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Veraenderbar<T[K]> }
    : T;

export type VeraenderbareOfferte = Veraenderbar<Offer>;

const PRUEFSUMME = 'a'.repeat(64);

const VORLAGE: VeraenderbareOfferte = {
  project: {
    referenznummer: 'A-2026-014',
  },
  property: {
    adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
    lagescores: [
      { value: { name: 'location', score: 0.72 }, provenance: 'pricehubble' },
      { value: { name: 'noise', score: 0.41 }, provenance: 'pricehubble' },
    ],
  },
  derivation: {
    alpha: 0.5,
    apartmentTypes: [
      {
        typeId: 'T-3.5',
        roomCount: 3.5,
        dossierParameters: {
          flaecheInnen: 82,
          flaecheAussen: 12,
          stockwerk: 2,
          energielabel: 'A',
          zustandsbewertungen: { bathrooms: 'new', kitchen: 'new' },
          qualitaetsbewertungen: { bathrooms: 'normal', kitchen: 'normal' },
          anzahlBadezimmer: 1,
          lift: true,
          baujahr: 2027,
          heizungsart: 'Waermepumpe',
        },
        referenceValuation: {
          value: {
            marktwert: 85_000_000,
            bewertungsdatum: '2026-08-16',
            anbieter: 'PriceHubble',
            konfidenzbereich: { von: 80_000_000, bis: 90_000_000 },
            konfidenzklasse: 'good',
            konfidenzwert: 0.86,
          },
          provenance: 'pricehubble',
        },
        referenceArea: { value: 88, provenance: 'local-derivation' },
        pricePerSqm: { value: 965_909.0909090909, provenance: 'local-derivation' },
      },
      {
        typeId: 'T-4.5',
        roomCount: 4.5,
        dossierParameters: {
          flaecheInnen: 104,
          flaecheAussen: 18,
          stockwerk: 3,
          energielabel: 'A',
          zustandsbewertungen: { bathrooms: 'new', kitchen: 'new' },
          qualitaetsbewertungen: { bathrooms: 'high', kitchen: 'high' },
          anzahlBadezimmer: 2,
          lift: true,
          baujahr: 2027,
          heizungsart: 'Waermepumpe',
        },
        referenceValuation: {
          value: {
            marktwert: 108_000_000,
            bewertungsdatum: '2026-08-16',
            anbieter: 'PriceHubble',
            konfidenzbereich: { von: 102_000_000, bis: 114_000_000 },
            konfidenzklasse: 'medium',
          },
          provenance: 'pricehubble',
        },
        referenceArea: { value: 113, provenance: 'local-derivation' },
        pricePerSqm: { value: 955_752.2123893806, provenance: 'local-derivation' },
      },
    ],
    units: [
      {
        unitNumber: 'A1.01',
        typeId: 'T-3.5',
        areaInner: 82,
        areaOuter: 12,
        floor: 1,
        weightedArea: { value: 88, provenance: 'local-derivation' },
        basePrice: { value: 85_000_000, provenance: 'local-derivation' },
        adjustments: [
          {
            value: {
              factor: -0.03,
              enteredAs: 'factor',
              justification: 'Nordlage, eingeschraenkte Besonnung',
              vorlageId: 'nordlage',
            },
            provenance: 'marketer-adjustment',
          },
        ],
        adjustmentSum: { value: -0.03, provenance: 'marketer-adjustment' },
        unitPrice: { value: 82_450_000, provenance: 'local-derivation' },
      },
      {
        unitNumber: 'A2.01',
        typeId: 'T-3.5',
        areaInner: 82,
        areaOuter: 14,
        floor: 2,
        weightedArea: { value: 89, provenance: 'local-derivation' },
        basePrice: { value: 85_965_909.09090909, provenance: 'local-derivation' },
        adjustments: [
          {
            value: {
              factor: 0.04,
              enteredAs: 'amount',
              enteredAmount: 3_438_636,
              justification: 'Seesicht ab dem zweiten Obergeschoss',
            },
            provenance: 'marketer-adjustment',
          },
        ],
        adjustmentSum: { value: 0.04, provenance: 'marketer-adjustment' },
        unitPrice: { value: 89_404_545, provenance: 'local-derivation' },
      },
      {
        unitNumber: 'A3.01',
        typeId: 'T-4.5',
        areaInner: 104,
        areaOuter: 18,
        floor: 3,
        weightedArea: { value: 113, provenance: 'local-derivation' },
        basePrice: { value: 108_000_000, provenance: 'local-derivation' },
        adjustments: [],
        adjustmentSum: { value: 0, provenance: 'marketer-adjustment' },
        unitPrice: { value: 108_000_000, provenance: 'local-derivation' },
      },
    ],
  },
  aggregates: {
    totalSalesValue: { value: 279_854_545, provenance: 'local-derivation' },
    einheitenzahl: 3,
    effortFactors: [
      {
        id: 'faktorA',
        bezeichnung: 'Lagequalitaet',
        quelle: 'lagescore',
        rawValue: 0.72,
        grenzeMin: 0,
        grenzeMax: 1,
        strategie: 'min-max',
        gekappt: false,
        normalised: 0.72,
        weight: 0.4,
        beitrag: 0.288,
      },
      {
        id: 'faktorB',
        bezeichnung: 'Projektumfang',
        quelle: 'abgeleitet',
        rawValue: 3,
        grenzeMin: 1,
        grenzeMax: 40,
        strategie: 'min-max',
        gekappt: false,
        normalised: 0.05128205128205128,
        weight: 0.35,
        beitrag: 0.017948717948717947,
      },
      {
        id: 'faktorC',
        bezeichnung: 'Erfassungsaufwand',
        quelle: 'manuell',
        rawValue: 3,
        grenzeMin: 1,
        grenzeMax: 5,
        strategie: 'min-max',
        gekappt: false,
        normalised: 0.5,
        weight: 0.25,
        beitrag: 0.125,
      },
    ],
    gewichtssumme: 1,
    effortIndicator: { value: 0.4309487179487179, provenance: 'local-calculation' },
    feeTier: {
      value: {
        k: 1,
        vMin: 200_000_000,
        vMax: 500_000_000,
        hMinK: 4_000_000,
        hMinK1: 8_000_000,
        hMaxK: 6_000_000,
        hMaxK1: 12_000_000,
        interpolationsAnteil: 0.2661818181818182,
      },
      provenance: 'local-calculation',
    },
    scalingFactor: { value: 1.0618948717948717, provenance: 'local-calculation' },
    feeBasis: {
      value: { min: 5_064_727.272727273, max: 7_597_090.909090909 },
      provenance: 'local-calculation',
    },
    feeRange: { value: { min: 5_378_186, max: 8_067_279 }, provenance: 'local-calculation' },
  },
  metadata: {
    offertId: 'A-2026-014',
    referenznummer: 'A-2026-014',
    erstelltAm: '2026-08-16T14:32:00.000Z',
    bewertungsversion: [
      { typeId: 'T-3.5', bewertungsdatum: '2026-08-16', konfidenzklasse: 'good' },
      { typeId: 'T-4.5', bewertungsdatum: '2026-08-16', konfidenzklasse: 'medium' },
    ],
    konfigurationsAbdruck: { meta: { konfigVersion: '1.0.0', schemaVersion: 1 } },
    konfigVersion: '1.0.0',
    konfigPruefsumme: PRUEFSUMME,
    berechnungsEingabe: { schemaVersion: 1, liegenschaft: { einheiten: 3 } },
  },
};

export function baueBeispielOfferte(): VeraenderbareOfferte {
  return structuredClone(VORLAGE);
}
