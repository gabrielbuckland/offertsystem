/**
 * Anti-Corruption Layer, Bewertungsrichtung (E-21).
 * Keine eigene Formel; Rundungsstellen gehoeren zur Preiskette von eq:qm_preis (E-09, E-10).
 * Zielstruktur ist die unveraenderte `Referenzbewertung` aus `packages/core`; der Adapter
 * definiert keine eigenen Feldnamen (I-23, Dependency Inversion).
 * Quadratmeterpreis wird NICHT uebernommen — eq:qm_preis bildet ihn lokal, da eine fremde
 * Flaechendefinition I-05 (Referenztreue) verletzen wuerde.
 */
import {
  rundeAufRappen,
  type RepraesentativeParametrisierung,
  type Referenzbewertung,
  type WohnungstypId,
} from '@offert/core';
import type { ValuationResponse } from '../schema/valuation-response.js';

export const ANBIETER = 'pricehubble';

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
      // Weggelassen statt undefined: exactOptionalPropertyTypes unterscheidet beides.
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
 * E-28: Feldmenge aus `RepraesentativeParametrisierung`, keine Vorgabewerte.
 * `flaecheAussen` -> `balconyArea`; `gardenArea` bleibt unbelegt, da eq:flaeche nur eine
 * Aussenflaeche mit einem Gewichtungsfaktor kennt (bewusste Vereinfachung).
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
      // energyLabel/heatingGenerationType sind serverseitig geschlossene Enums ohne
      // Leerwert (live geprueft 2026-09-01); '' wird deshalb weggelassen statt gesendet,
      // sonst lehnt die API das ganze PATCH mit 400 ab.
      ...(p.energielabel === '' ? {} : { energyLabel: p.energielabel }),
      ...(p.heizungsart === '' ? {} : { heatingGenerationType: p.heizungsart }),
    },
  };
}
