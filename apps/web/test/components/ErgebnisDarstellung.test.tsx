import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  formatiereAggregat,
  formatiereBetrag,
  formatiereFlaeche,
} from '@offert/offer';
import { OfferteDokument } from '@offert/offer/template';
import { ErgebnisDarstellung } from '../../src/components/ErgebnisDarstellung.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

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
    expect(html).toContain(formatiereAggregat(t.referenceValuation.value.marktwert));
    expect(html).toContain(formatiereFlaeche(t.referenceArea.value));
    expect(html).toContain(formatiereBetrag(t.pricePerSqm.value));
    for (const label of ['eq:flaeche', 'eq:qm_preis', 'eq:verkaufssumme',
                         'eq:aufwandindikator', 'eq:honorar_mapping']) {
      expect(html, `Formelverweis ${label} fehlt`).toContain(label);
    }
  });
});
