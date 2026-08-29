import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Aggregatleiste,
  type AggregatleisteProps,
} from '../../../src/components/projekt/Aggregatleiste.js';

/** Gemeinsame Basis-Props: ein vollstaendiges, ruhendes Ergebnis. Tests ueberschreiben
 *  gezielt die Felder, die das jeweilige Verhalten ausloesen. */
function basisProps(): AggregatleisteProps {
  return {
    verkaufssumme: 893_550_000,
    honorarMin: 16_629_700,
    honorarMax: 22_173_000,
    aufwandindikator: undefined,
    erzeuge: () => undefined,
    laeuft: false,
    speichernLaeuft: false,
    berechnungLaeuft: false,
    zeigeRechenweg: () => undefined,
  };
}

describe('Aggregatleiste', () => {
  it('weist fehlende Aggregate aus, statt Nullen zu zeigen', () => {
    const html = renderToStaticMarkup(
      <Aggregatleiste {...basisProps()} verkaufssumme={undefined} honorarMin={undefined}
                      honorarMax={undefined} />);
    expect(html).toContain('—');
    expect(html).not.toContain('0.00');
  });

  it('sperrt die Schaltflaeche, solange kein Ergebnis vorliegt', () => {
    const html = renderToStaticMarkup(
      <Aggregatleiste {...basisProps()} verkaufssumme={undefined} honorarMin={undefined}
                      honorarMax={undefined} />);
    expect(html).toContain('disabled');
  });

  it('sperrt die Schaltflaeche mit Begruendung, waehrend gespeichert/neu gerechnet wird '
    + '— auch wenn alle Aggregate vorliegen (schliesst die 400-ms-Luecke)', () => {
    const html = renderToStaticMarkup(
      <Aggregatleiste {...basisProps()} speichernLaeuft={true} />);
    expect(html).toContain('disabled');
    expect(html).toContain('Änderungen werden gespeichert und neu berechnet …');
  });

  it('zeigt bei Honorar-Abbruch die Meldung als Alarm, keine Honorarrange-Zahl — '
    + 'die Verkaufssumme bleibt sichtbar (E-04)', () => {
    const meldung = 'Die Verkaufssumme liegt ausserhalb der konfigurierten Staffel.';
    const html = renderToStaticMarkup(
      <Aggregatleiste {...basisProps()} honorarAbbruchMeldung={meldung} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain(meldung);
    expect(html).toContain('8’935’500');
    expect(html).not.toContain('16’629’700');
    expect(html).not.toContain('22’173’000');
  });
});
