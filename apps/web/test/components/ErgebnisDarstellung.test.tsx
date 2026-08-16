import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BewertungsBuendel, StufenFehler, WohnungstypId } from '@offert/core';
import {
  OfferteDokument,
  formatiereAggregat,
  formatiereBetrag,
  formatiereFlaeche,
} from '@offert/offer';
import { ErgebnisDarstellung } from '../../src/components/ErgebnisDarstellung.js';
import { HonorarAbbruch } from '../../src/components/HonorarAbbruch.js';
import { TeilergebnisHinweis } from '../../src/components/TeilergebnisHinweis.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

const FEHLER_AUSSERHALB: StufenFehler = {
  stufe: 5,
  code: 'VERKAUFSSUMME_AUSSERHALB',
  parameter: { v: 25_000_000_000, vMin: 100_000_000, vMax: 20_000_000_000 },
};

const TEILERGEBNIS = {
  verkaufssumme: 25_000_000_000,
  aufwandindikator: 0.43,
  positionen: [{ wohnungsnummer: 'A1.01', preis: 82_450_000 }],
};

const VOLLSTAENDIG: BewertungsBuendel = { vollstaendig: true, bewertungen: new Map() };

describe('ErgebnisDarstellung', () => {
  it('erweitert die Offertdarstellung nur um Bedienelemente', () => {
    const o = baueBeispielOfferte();
    const dokument = renderToStaticMarkup(<OfferteDokument offerte={o} />);
    const ergebnis = renderToStaticMarkup(<ErgebnisDarstellung offerte={o} />);
    expect(ergebnis).toContain(dokument);
    expect(ergebnis).toContain('class="bedienelement"');
  });

  it('zeigt zu jeder Ergebnisgroesse ihre Eingangsgroessen an derselben Stelle (US-12)', () => {
    const o = baueBeispielOfferte();
    const html = renderToStaticMarkup(<ErgebnisDarstellung offerte={o} />);
    const t = o.derivation.apartmentTypes[0]!;
    // q_t = P_t^ref / A_t^ref: alle drei Groessen im selben Abschnitt
    expect(html).toContain(formatiereAggregat(t.referenceValuation.value.marktwert));
    expect(html).toContain(formatiereFlaeche(t.referenceArea.value));
    expect(html).toContain(formatiereBetrag(t.pricePerSqm.value));
    for (const label of ['eq:flaeche', 'eq:qm_preis', 'eq:verkaufssumme',
                         'eq:aufwandindikator', 'eq:honorar_mapping']) {
      expect(html, `Formelverweis ${label} fehlt`).toContain(label);
    }
  });
});

describe('HonorarAbbruch (E-04)', () => {
  it('stellt Verkaufssumme und Aufwandindikator dar und laesst die Honorarrange leer', () => {
    const html = renderToStaticMarkup(
      <HonorarAbbruch teilergebnis={TEILERGEBNIS} fehler={FEHLER_AUSSERHALB} />);
    expect(html).toContain(formatiereAggregat(250_000_000 * 100));
    expect(html).toContain('Die Honorarstaffelung ist zu erweitern.');
    expect(html).not.toMatch(/Honorarrange\s*<\/h\d>\s*<span[^>]*>CHF/);
  });

  it('nennt keinen Naeherungswert und keinen Randwert der obersten Stufe', () => {
    const html = renderToStaticMarkup(
      <HonorarAbbruch teilergebnis={TEILERGEBNIS} fehler={FEHLER_AUSSERHALB} />);
    for (const verboten of ['ungefähr', 'ca.', 'geschätzt', 'Näherung', 'maximal möglich']) {
      expect(html).not.toContain(verboten);
    }
  });
});

describe('TeilergebnisHinweis (PE-23, US-15, NFA-10)', () => {
  it('kennzeichnet ein unvollstaendiges Bewertungsergebnis und bietet keine Offerte an', () => {
    const html = renderToStaticMarkup(
      <TeilergebnisHinweis buendel={{
        vollstaendig: false,
        fehlgeschlagenerTyp: 'T-3.5' as WohnungstypId,
        bewertungen: new Map(),
      }} />);
    expect(html).toContain('3.5');
    expect(html).toContain('Es wurde keine Offerte erzeugt.');
    expect(html).not.toContain('Honorarrange');
    expect(html).toContain('role="alert"');
  });

  it('rendert bei vollstaendigem Buendel nichts', () => {
    expect(renderToStaticMarkup(<TeilergebnisHinweis buendel={VOLLSTAENDIG} />)).toBe('');
  });
});
