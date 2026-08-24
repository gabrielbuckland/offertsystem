import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Aggregatleiste } from '../../../src/components/projekt/Aggregatleiste.js';

describe('Aggregatleiste', () => {
  it('zeigt Verkaufssumme und Honorarrange, sobald sie vorliegen', () => {
    const html = renderToStaticMarkup(
      <Aggregatleiste verkaufssumme={893_550_000} honorarMin={16_629_700}
                      honorarMax={22_173_000} erzeuge={() => undefined} laeuft={false} />);
    expect(html).toContain('8’935’500');
    expect(html).toContain('Offerte generieren');
  });

  it('weist fehlende Aggregate aus, statt Nullen zu zeigen', () => {
    const html = renderToStaticMarkup(
      <Aggregatleiste verkaufssumme={undefined} honorarMin={undefined}
                      honorarMax={undefined} erzeuge={() => undefined} laeuft={false} />);
    expect(html).toContain('—');
    expect(html).not.toContain('0.00');
  });

  it('sperrt die Schaltflaeche, solange kein Ergebnis vorliegt', () => {
    const html = renderToStaticMarkup(
      <Aggregatleiste verkaufssumme={undefined} honorarMin={undefined}
                      honorarMax={undefined} erzeuge={() => undefined} laeuft={false} />);
    expect(html).toContain('disabled');
  });
});
