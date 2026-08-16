/**
 * E-04: Der Kern extrapoliert oberhalb der letzten Stuetzstelle nicht und bricht definiert
 * ab. Die Verkaufssumme aus Stufe 2 bleibt gueltig; an der Stelle der Honorarrange steht
 * KEINE Zahl, sondern eine handlungsleitende Meldung an den Auftraggeber — der Fall ist
 * eine Konfigurationsluecke, kein Eingabefehler.
 *
 * Ein Naeherungswert oder der Randwert der obersten Stufe waere hier das Gegenteil von
 * Transparenz: Er saehe aus wie ein Ergebnis, ohne eines zu sein.
 */
import type { StufenFehler } from '@offert/core';
import { HerkunftsBlock, HerkunftsWert, formatiereAggregat, formatiereScore } from '@offert/offer';
import { uebersetzeStufenFehler } from '../server/fehlertexte.js';

export interface HonorarTeilergebnis {
  readonly verkaufssumme: number;
  readonly aufwandindikator: number;
  readonly positionen: readonly {
    readonly wohnungsnummer: string;
    readonly preis: number;
  }[];
}

export interface HonorarAbbruchProps {
  readonly teilergebnis: HonorarTeilergebnis;
  readonly fehler: StufenFehler;
}

export function HonorarAbbruch({ teilergebnis, fehler }: HonorarAbbruchProps) {
  const meldung = uebersetzeStufenFehler(fehler);
  return (
    <div className="ergebnis ergebnis--unvollstaendig">
      <HerkunftsBlock klasse="local-derivation" titel="Preisableitung">
        <table className="einheiten">
          <thead><tr><th>Einheit</th><th>Wohnungspreis</th></tr></thead>
          <tbody>
            {teilergebnis.positionen.map((p) => (
              <tr key={p.wohnungsnummer} className="einheit-zeile">
                <td>{p.wohnungsnummer}</td>
                <td>{formatiereAggregat(p.preis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <HerkunftsWert wert={{ value: teilergebnis.verkaufssumme, provenance: 'local-derivation' }}
                       beschriftung="Verkaufssumme V" formatiere={formatiereAggregat} />
      </HerkunftsBlock>
      <HerkunftsBlock klasse="local-calculation" titel="Aufwandindikator">
        <HerkunftsWert wert={{ value: teilergebnis.aufwandindikator,
                               provenance: 'local-calculation' }}
                       beschriftung="Aufwandindikator D" formatiere={formatiereScore} />
      </HerkunftsBlock>
      <section className="honorar-abbruch" role="alert" data-adressat={meldung.adressat}>
        <h3>Honorarrange</h3>
        <p>{meldung.text}</p>
        <p>Es wurde keine Offerte erzeugt.</p>
      </section>
    </div>
  );
}
