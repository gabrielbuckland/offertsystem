/**
 * Keine Formel. Darstellungspflicht (Spec 05 §2.2, Regel 3): Es gibt keinen Pfad, der
 * einen Wert ohne seine Herkunft ausgibt. Der Rohwert steckt in `Provenanced` und ist
 * nur ueber diese Komponente darstellbar.
 *
 * Das Format wird UEBERGEBEN, nicht gewaehlt: Waehlte die Komponente es selbst,
 * entstuende hier eine zweite Formatierungsregel neben `format/de-ch.ts`.
 *
 * Die Zuordnung traegt `data-herkunft`. Im Druck ist sie schwarzweiss lesbar, weil
 * Beschriftung und Abschnitt sie ohnehin im Text fuehren (AK-2.4) — die Kennzeichnung
 * haengt also nicht an einer Farbe.
 */
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
