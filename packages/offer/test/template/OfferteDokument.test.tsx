import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  formatiereAggregat,
  formatiereHonorarProzent,
  formatiereProzent,
  formatiereScore,
} from '../../src/format/de-ch.js';
import { berechneHonorarProzent } from '../../src/model/honorar-eingabe.js';
import { OfferteDokument } from '../../src/template/OfferteDokument.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';
import type { Offer } from '../../src/model/offer.js';

function beispiel(): Offer {
  return baueBeispielOfferte() as unknown as Offer;
}

const QUELLE = readFileSync(
  new URL('../../src/template/OfferteDokument.tsx', import.meta.url), 'utf8',
);

describe('OfferteDokument — reine Funktion', () => {
  it('rendert ohne Zustand und ohne Effekte', () => {
    for (const verboten of ['useState', 'useEffect', 'fetch(', "'use client'"]) {
      expect(QUELLE).not.toContain(verboten);
    }
  });

  it('liefert bei gleicher Eingabe gleiches Markup', () => {
    const o = beispiel();
    expect(renderToStaticMarkup(<OfferteDokument offerte={o} />))
      .toBe(renderToStaticMarkup(<OfferteDokument offerte={o} />));
  });
});

describe('OfferteDokument — Preisableitung', () => {
  it('zeigt jede Anpassung einzeln mit Begruendung, nicht nur den Saldo', () => {
    const o = beispiel();
    const html = renderToStaticMarkup(<OfferteDokument offerte={o} />);
    for (const a of o.derivation.units[0]!.adjustments) {
      expect(html).toContain(a.value.justification);
      expect(html).toContain(formatiereProzent(a.value.factor));
    }
  });
});

describe('OfferteDokument — aggregierte Werte (US-12)', () => {
  it('weist je Faktor Rohwert, Grenzen, normalisierten Wert, Gewicht und Beitrag aus', () => {
    const o = beispiel();
    const html = renderToStaticMarkup(<OfferteDokument offerte={o} />);
    for (const f of o.aggregates.effortFactors) {
      expect(html).toContain(f.bezeichnung);
      expect(html).toContain(formatiereScore(f.normalised));
      expect(html).toContain(formatiereScore(f.weight));
      expect(html).toContain(formatiereScore(f.beitrag));
    }
    const t = o.aggregates.feeTier.value;
    for (const wert of [t.hMinK, t.hMinK1, t.hMaxK, t.hMaxK1, t.vMin, t.vMax]) {
      expect(html).toContain(formatiereAggregat(wert));
    }
  });
});

describe('OfferteDokument — Herkunft und Datengetriebenheit', () => {
  it('rendert keinen wertfuehrenden Knoten ohne Herkunftszuordnung', () => {
    const html = renderToStaticMarkup(<OfferteDokument offerte={beispiel()} />);
    const bloecke = html.split('data-herkunft=').length - 1;
    expect(bloecke).toBeGreaterThanOrEqual(4);
  });

  it('nennt keinen einzelnen Faktorbezeichner', () => {
    for (const verboten of ['lage_gesamt', 'projektumfang', 'preissegment', 'objektzustand']) {
      expect(QUELLE).not.toContain(verboten);
    }
  });
});

describe('OfferteDokument — Honorarbetrag statt Range (Spec 2026-08-29)', () => {
  it('zeigt den gewaehlten Betrag in Franken UND zusaetzlich als Prozentsatz der '
    + 'Verkaufssumme, wenn die Offerte einen gewaehlten Betrag fuehrt', () => {
    const o = beispiel();
    (o as { aggregates: { gewaehltesHonorar?: unknown } }).aggregates.gewaehltesHonorar = {
      value: 6_722_733, provenance: 'marketer-decision',
    };
    const html = renderToStaticMarkup(<OfferteDokument offerte={o} />);
    expect(html).toContain(formatiereAggregat(6_722_733));
    const anteil = berechneHonorarProzent(6_722_733, o.aggregates.totalSalesValue.value);
    expect(anteil).not.toBeNull();
    expect(html).toContain(formatiereHonorarProzent(anteil!));
  });

  it('zeigt keinen Betrag, wenn ein Altartefakt keinen gewaehlten Betrag fuehrt', () => {
    const html = renderToStaticMarkup(<OfferteDokument offerte={beispiel()} />);
    expect(html).toContain('Honorarbetrag: —');
  });
});

describe('OfferteDokument — Regelspur bleibt intern', () => {
  it('nennt die Regelspur NICHT im Dokument — die Offerte geht an den Eigentuemer', () => {
    const offerte = beispiel();
    // regelwert bewusst != adjustment.factor (-0.03): sonst wuerde die Assertion unten
    // zufaellig eine andere, legitime Zahl im Dokument treffen statt echt die Regelspur.
    offerte.derivation.units[0]!.adjustments[0]!.value.regel = {
      merkmal: 'stockwerk', merkmalswert: 2, bereich: 2, regelwert: -0.07,
    };
    offerte.derivation.units[0]!.adjustments[0]!.value.uebersteuert = true;
    const html = renderToStaticMarkup(<OfferteDokument offerte={offerte} />);
    // Kleinschreibung/"Bereich"/"Regelwert" kommen im regelspurfreien Dokument bereits vor
    // ("Stockwerk", "Konfidenzbereich") — die exakte Schreibung hier ist echt diskriminierend.
    expect(html).not.toContain('stockwerk');
    expect(html).not.toContain('Bereich');
    expect(html).not.toContain('Regelwert');
    // toLowerCase() faengt "übersteuert"/"Übersteuert" unabhaengig von kuenftiger Formulierung.
    expect(html.toLowerCase()).not.toContain('bersteuer');
    const regelwert = offerte.derivation.units[0]!.adjustments[0]!.value.regel.regelwert;
    expect(html).not.toContain(String(regelwert));
    expect(html).not.toContain(formatiereProzent(regelwert));
  });
});
