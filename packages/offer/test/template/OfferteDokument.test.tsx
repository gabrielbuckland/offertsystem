import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  formatiereAggregat,
  formatiereProzent,
  formatiereScore,
} from '../../src/format/de-ch.js';
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
