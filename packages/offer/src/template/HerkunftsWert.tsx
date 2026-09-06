// Keine Formel. Darstellungspflicht: kein Pfad gibt einen Wert ohne Herkunft aus.
// Format wird uebergeben, nicht gewaehlt, sonst entstuende eine zweite Formatierungsregel
// neben format/de-ch.ts. AK-2.4: data-herkunft ist im Druck schwarzweiss lesbar, da
// Beschriftung/Abschnitt die Herkunft ohnehin im Text fuehren.
import type { Herkunft, Provenanced } from '../model/provenance.js';
import { HERKUNFT_BESCHRIFTUNG } from '../model/provenance.js';

export interface HerkunftsWertProps<T, P extends Herkunft> {
  readonly wert: Provenanced<T, P>;
  readonly beschriftung: string;
  readonly formatiere: (wert: T) => string;
}

export function HerkunftsWert<T, P extends Herkunft>(
  { wert, beschriftung, formatiere }: HerkunftsWertProps<T, P>,
) {
  return (
    <span className="herkunfts-wert" data-herkunft={wert.provenance}>
      <span className="herkunfts-wert__beschriftung">{beschriftung}</span>
      <span className="herkunfts-wert__zahl">{formatiere(wert.value)}</span>
      <span className="herkunfts-wert__quelle">{HERKUNFT_BESCHRIFTUNG[wert.provenance]}</span>
    </span>
  );
}

export interface HerkunftsBlockProps {
  readonly klasse: Herkunft;
  readonly titel: string;
  readonly children: React.ReactNode;
}

export function HerkunftsBlock({ klasse, titel, children }: HerkunftsBlockProps) {
  return (
    <section className="herkunfts-block" data-herkunft={klasse}>
      <h3 className="herkunfts-block__titel">{titel}</h3>
      <p className="herkunfts-block__quelle">{HERKUNFT_BESCHRIFTUNG[klasse]}</p>
      {children}
    </section>
  );
}
