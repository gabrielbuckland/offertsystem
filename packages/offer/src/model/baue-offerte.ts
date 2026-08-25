/**
 * Keine Formel. Zusammenbau des Offert-Objekts (E-19, E-20).
 *
 * Hier wird nichts gerechnet: Jede Zahl stammt aus `BerechnungsErgebnis`. Eine zweite
 * Multiplikation an dieser Stelle waere genau die Rechenlogik, die die Boundary-Regel
 * ausschliesst — und sie koennte vom Kern abweichen, ohne dass ein Test das saehe.
 *
 * Der Zusammenbau liegt in `packages/offer` und nicht im Kern, weil die
 * Abhaengigkeitsrichtung core -> offer verboten ist (E-20).
 */
import {
  serialisiereKonfiguration,
  type BerechnungsErgebnis,
  type Liegenschaft,
} from '@offert/core';
import { offerSchema, type Offer } from './offer.js';
import { herkunft } from './provenance.js';

export interface OfferteEingang {
  /** Einzige Quelle der Rechenwerte (E-19). */
  readonly ergebnis: BerechnungsErgebnis;
  /** Stammt aus der Erfassungsschicht, nicht aus dem Kern (E-20). */
  readonly liegenschaft: Liegenschaft;
  /** Projektangaben aus der Erfassung; nur die Kennung des erzeugenden Projekts. */
  readonly projekt: {
    readonly projektId: string;
  };
  /** Erzeugt in apps/web/src/server (E-26, E-29) — hier nur entgegengenommen. */
  readonly meta: {
    readonly offertId: string;
    readonly erstelltAm: string;
    readonly konfigVersion: string;
    /** Aus P1s KonfigurationsFingerabdruck, nicht hier gebildet (PE-04). */
    readonly konfigPruefsumme: string;
    /** Ergebnis von serialisiereEingang(), nicht die Formulardaten (PE-08). */
    readonly berechnungsEingabe: Readonly<Record<string, unknown>>;
  };
}

function baueTypAbleitungen(e: OfferteEingang): unknown[] {
  return e.ergebnis.verkaufssumme.typAbleitungen.map((t) => {
    const bewertung = e.ergebnis.bewertungen.get(t.wohnungstypId);
    const typ = e.liegenschaft.wohnungstypen.find((w) => w.id === t.wohnungstypId);
    if (bewertung === undefined || typ === undefined) {
      // Defekt, kein Fachfehler: Stufe 1 hat die Vollstaendigkeit bereits geprueft
      // (S-03). Ein Fehlen hier hiesse, dass Ergebnis und Liegenschaft nicht
      // zusammengehoeren — daran ist nichts zu retten.
      throw new Error(`Referenzbewertung oder Wohnungstyp fehlt fuer ${t.wohnungstypId}`);
    }
    const anzeige = bewertung.anzeige;
    return {
      typeId: t.wohnungstypId as string,
      roomCount: typ.zimmerzahl,
      dossierParameters: typ.parametrisierung,
      referenceValuation: herkunft({
        marktwert: bewertung.marktwert,
        bewertungsdatum: bewertung.bewertungsdatum,
        anbieter: bewertung.anbieter,
        konfidenzbereich: anzeige.konfidenzbereich,
        konfidenzklasse: anzeige.konfidenzklasse,
        // Nur setzen, wenn vorhanden: Unter exactOptionalPropertyTypes sind
        // «weggelassen» und «ausdruecklich undefined» verschiedene Dinge, und
        // `.strict()` wuerde ein Feld mit undefined nicht als fehlend lesen.
        ...(anzeige.konfidenzwert === undefined ? {} : { konfidenzwert: anzeige.konfidenzwert }),
      }, 'pricehubble'),
      referenceArea: herkunft(t.referenzflaeche, 'local-derivation'),
      pricePerSqm: herkunft(t.quadratmeterpreis, 'local-derivation'),
    };
  });
}

function baueEinheiten(e: OfferteEingang): unknown[] {
  return e.ergebnis.verkaufssumme.positionen.map((p) => {
    const einheit = e.liegenschaft.einheiten
      .find((x) => x.wohnungsnummer === p.wohnungsnummer);
    if (einheit === undefined) {
      throw new Error(`Einheit fehlt fuer ${p.wohnungsnummer}`);
    }
    return {
      unitNumber: p.wohnungsnummer as string,
      typeId: p.wohnungstypId as string,
      areaInner: einheit.flaecheInnen,
      areaOuter: einheit.flaecheAussen,
      weightedArea: herkunft(p.gewichteteFlaeche, 'local-derivation'),
      basePrice: herkunft(p.basispreis, 'local-derivation'),
      adjustments: p.anpassungen.map((a) => herkunft({
        factor: a.faktor,
        enteredAs: a.erfassungsform === 'absolut' ? 'amount' as const : 'factor' as const,
        ...(a.erfassterBetrag === undefined ? {} : { enteredAmount: a.erfassterBetrag }),
        justification: a.begruendung,
        // Weglassen statt erfinden: Nur eine aus einer Vorlage uebernommene Anpassung
        // traegt die Kennung; daran haengt die Unterscheidung «aus Vorlage / veraendert
        // / frei erfasst» (PE-07, A-13).
        ...(a.vorlageId === undefined ? {} : { vorlageId: a.vorlageId }),
      }, 'marketer-adjustment')),
      adjustmentSum: herkunft(p.anpassungssumme, 'marketer-adjustment'),
      unitPrice: herkunft(p.preis, 'local-derivation'),
    };
  });
}

function baueFaktorspuren(e: OfferteEingang): unknown[] {
  const beitraege = new Map(
    e.ergebnis.gewichtung.beitraege.map((b) => [b.faktorId, b]),
  );
  // Die Liste iteriert ueber die Konfiguration; kein Faktorbezeichner steht im Code (I-13).
  return e.ergebnis.normalisierung.faktoren.map((f) => {
    const parameter = e.ergebnis.konfigurationsAbdruck.faktoren.get(f.faktorId);
    const beitrag = beitraege.get(f.faktorId);
    if (parameter === undefined || beitrag === undefined) {
      throw new Error(`Faktorparameter oder Beitrag fehlt fuer ${f.faktorId}`);
    }
    return {
      id: f.faktorId as string,
      bezeichnung: parameter.bezeichnung,
      quelle: parameter.quelle,
      rawValue: f.rohwert,
      grenzeMin: f.grenzeMin,
      grenzeMax: f.grenzeMax,
      strategie: f.strategie,
      gekappt: f.gekappt,
      normalised: f.normiert,
      weight: beitrag.gewicht,
      beitrag: beitrag.beitrag,
    };
  });
}

export function baueOfferte(e: OfferteEingang): Offer {
  const h = e.ergebnis.honorar;
  const roh = {
    project: e.projekt,
    property: {
      adresse: e.liegenschaft.adresse,
      lagescores: [...e.ergebnis.lagescores.werte].map(([name, wert]) =>
        herkunft({ name: name as string, score: wert as number }, 'pricehubble')),
    },
    derivation: {
      alpha: e.ergebnis.verkaufssumme.alpha,
      apartmentTypes: baueTypAbleitungen(e),
      units: baueEinheiten(e),
    },
    aggregates: {
      totalSalesValue: herkunft(e.ergebnis.verkaufssumme.verkaufssumme, 'local-derivation'),
      einheitenzahl: e.ergebnis.verkaufssumme.einheitenzahl,
      effortFactors: baueFaktorspuren(e),
      gewichtssumme: e.ergebnis.gewichtung.gewichtssumme,
      effortIndicator: herkunft(e.ergebnis.gewichtung.aufwandindikator, 'local-calculation'),
      // Aufgeloest uebernommen, nicht nachgeschlagen: Die Stufenwahl gehoert dem Kern.
      feeTier: herkunft({ k: h.stufenindex, ...h.stufe,
                          interpolationsAnteil: h.interpolationsanteil }, 'local-calculation'),
      scalingFactor: herkunft(h.skalierung, 'local-calculation'),
      feeBasis: herkunft({ min: h.basisMin, max: h.basisMax }, 'local-calculation'),
      feeRange: herkunft({ min: h.honorarMin, max: h.honorarMax }, 'local-calculation'),
    },
    metadata: {
      offertId: e.meta.offertId,
      projektId: e.projekt.projektId,
      erstelltAm: e.meta.erstelltAm,
      bewertungsversion: [...e.ergebnis.bewertungen].map(([id, b]) => ({
        typeId: id as string,
        bewertungsdatum: b.bewertungsdatum,
        konfidenzklasse: b.anzeige.konfidenzklasse,
      })),
      // Eingebettete KOPIE, kein Verweis (E-26): Ein Pfad auf die Konfigurationsdatei
      // waere beim naechsten Konfigwechsel wertlos.
      konfigurationsAbdruck: serialisiereKonfiguration(e.ergebnis.konfigurationsAbdruck),
      konfigVersion: e.meta.konfigVersion,
      konfigPruefsumme: e.meta.konfigPruefsumme,
      berechnungsEingabe: e.meta.berechnungsEingabe,
    },
  };
  return offerSchema.parse(roh);
}
