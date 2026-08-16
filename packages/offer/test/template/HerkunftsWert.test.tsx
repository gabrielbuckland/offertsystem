import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatiereAggregat } from '../../src/format/de-ch.js';
import { HERKUNFT_BESCHRIFTUNG, herkunft } from '../../src/model/provenance.js';
import { HerkunftsBlock, HerkunftsWert } from '../../src/template/HerkunftsWert.js';

describe('HerkunftsWert', () => {
  it('gibt Wert und Herkunftsbeschriftung gemeinsam aus', () => {
    const html = renderToStaticMarkup(
      <HerkunftsWert wert={herkunft(125_000_000, 'pricehubble')}
                     beschriftung="Referenz-Marktwert"
                     formatiere={formatiereAggregat} />,
    );
    expect(html).toContain(formatiereAggregat(125_000_000));
    expect(html).toContain('Bewertung PriceHubble');
    expect(html).toContain('data-herkunft="pricehubble"');
  });
});

describe('HerkunftsBlock', () => {
  it('kennzeichnet einen Abschnitt mit seiner Herkunftsklasse', () => {
    const html = renderToStaticMarkup(
      <HerkunftsBlock klasse="marketer-adjustment" titel="Anpassungen">
        <p>x</p>
      </HerkunftsBlock>,
    );
    expect(html).toContain('data-herkunft="marketer-adjustment"');
    expect(html).toContain('Anpassung Vermarkter');
    expect(html).toContain('herkunfts-block');
  });

  it.each(['pricehubble', 'local-derivation', 'marketer-adjustment', 'local-calculation'] as const)(
    'beschriftet die Klasse %s im Markup', (klasse) => {
      const html = renderToStaticMarkup(
        <HerkunftsBlock klasse={klasse} titel="t"><p /></HerkunftsBlock>,
      );
      expect(html).toContain(HERKUNFT_BESCHRIFTUNG[klasse]);
    },
  );
});
