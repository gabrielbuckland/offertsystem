/**
 * Anti-Corruption Layer, Bewertungsrichtung (Spec 04 §4.1, E-21).
 * Keine eigene Formel; die Rundungsstellen gehoeren zur Preiskette von eq:qm_preis.
 *
 * Zielstruktur ist die UNVERAENDERTE `Referenzbewertung` aus `packages/core`; der
 * Adapter definiert keine eigenen Feldnamen (I-23, Dependency Inversion).
 *
 * Rundungsstellen (E-09, E-10):
 *   R1 — `marktwert`, erste der zwei Rundungsstellen der Preisableitung
 *   R0 — `anzeige.konfidenzbereich`, reine Anzeige, wirkt rechnerisch nicht weiter
 * Beide ueber `rundeAufRappen` aus `@offert/core`; kein `Math.round`.
 *
 * Der Quadratmeterpreis wird NICHT uebernommen — eq:qm_preis bildet ihn lokal, weil
 * ein fremder Quadratmeterpreis auf einer fremden Flaechendefinition beruhte und I-05
 * (Referenztreue) dann nicht mehr exakt gaelte (Spec 04 §4.3).
 */
import {
  rundeAufRappen,
  type RepraesentativeParametrisierung,
  type Referenzbewertung,
  type WohnungstypId,
} from '@offert/core';
import type { ValuationResponse } from '../schema/valuation-response.js';

export const ANBIETER = 'pricehubble';

/** Franken je Rappen; Einheitenumrechnung, kein Verhaltensparameter (G-4). */
const RAPPEN_JE_FRANKEN = 100;

export function aufReferenzbewertung(args: {
  readonly wohnungstypId: WohnungstypId;
  readonly antwort: ValuationResponse;
  readonly parametrisierungsAbdruck: RepraesentativeParametrisierung;
}): Referenzbewertung {
  const verkauf = args.antwort.valuationSale;
  return {
    wohnungstypId: args.wohnungstypId,
    marktwert: rundeAufRappen(verkauf.value * RAPPEN_JE_FRANKEN),
    bewertungsdatum: verkauf.valuationDate,
    anbieter: ANBIETER,
    parametrisierungsAbdruck: args.parametrisierungsAbdruck,
    anzeige: {
      konfidenzbereich: {
        von: rundeAufRappen(verkauf.valueRange.lower * RAPPEN_JE_FRANKEN),
        bis: rundeAufRappen(verkauf.valueRange.upper * RAPPEN_JE_FRANKEN),
      },
      konfidenzklasse: verkauf.valuationConfidence,
      // Weggelassen statt auf undefined gesetzt: `exactOptionalPropertyTypes`
      // unterscheidet beides, und `konfidenzwert` ist im Vertrag optional.
      ...(verkauf.valuationConfidenceScore === undefined
        ? {}
        : { konfidenzwert: verkauf.valuationConfidenceScore }),
    },
  };
}

export interface DossierBody {
  readonly property: Readonly<Record<string, unknown>>;
}

/**
 * Der E3-Body entsteht ausschliesslich aus den zehn Feldern der verbindlichen Liste
 * `RepraesentativeParametrisierung` (E-28). Der Adapter definiert die Feldmenge
 * nicht selbst und sendet keine Vorgabewerte.
 *
 * `flaecheAussen` wird auf `balconyArea` abgebildet; `gardenArea` wird nicht gesetzt
 * (Spec 04 §1.4). eq:flaeche kennt genau eine Aussenflaeche mit genau einem
 * Gewichtungsfaktor; eine Aufteilung auf zwei API-Felder setzte eine Regel voraus,
 * die das Modell nicht hergibt. Vereinfachung, ausgewiesen als N-17.
 */
export function dossierBody(p: RepraesentativeParametrisierung): DossierBody {
  return {
    property: {
      livingArea: p.flaecheInnen,
      balconyArea: p.flaecheAussen,
      floorNumber: p.stockwerk,
      condition: p.zustandsbewertungen,
      quality: p.qualitaetsbewertungen,
      numberOfBathrooms: p.anzahlBadezimmer,
      hasLift: p.lift,
      buildingYear: p.baujahr,
      // `energyLabel` und `heatingGenerationType` sind serverseitig geschlossene
      // Aufzaehlungen OHNE Leerwert (live belegt 2026-09-01: energyLabel nur
      // minergie*, heatingGenerationType nur electric|wood|gas|oil|district|
      // heat_pump_air|heat_pump_geothermal|solar). Ein leeres Feld wird deshalb
      // weggelassen statt als '' gesendet — sonst lehnt die API das ganze PATCH
      // mit 400 ab, und eine Liegenschaft ohne Minergie-Label waere ueberhaupt
      // nicht bewertbar.
      ...(p.energielabel === '' ? {} : { energyLabel: p.energielabel }),
      ...(p.heizungsart === '' ? {} : { heatingGenerationType: p.heizungsart }),
    },
  };
}
