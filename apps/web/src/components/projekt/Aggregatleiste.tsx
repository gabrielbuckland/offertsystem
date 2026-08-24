'use client';
import { formatiereAggregat } from '@offert/offer/src/format/de-ch.js';
import { Button } from '../ui/button.js';

export interface AggregatleisteProps {
  readonly verkaufssumme: number | undefined;
  readonly honorarMin: number | undefined;
  readonly honorarMax: number | undefined;
  readonly erzeuge: () => void;
  readonly laeuft: boolean;
}

/**
 * Ein fehlendes Aggregat wird als solches ausgewiesen und nicht als Null dargestellt:
 * Null ist ein gueltiger Rechenwert, «noch nicht berechnet» ist keiner (I-24).
 */
export function Aggregatleiste(
  { verkaufssumme, honorarMin, honorarMax, erzeuge, laeuft }: AggregatleisteProps,
) {
  const vollstaendig = verkaufssumme !== undefined
    && honorarMin !== undefined && honorarMax !== undefined;

  return (
    <section className="mt-8 flex items-end justify-between border-t border-border pt-6">
      <dl className="flex gap-10">
        <div>
          <dt className="text-sm text-muted-foreground">Verkaufssumme</dt>
          <dd className="text-lg font-medium">
            {verkaufssumme === undefined ? '—' : formatiereAggregat(verkaufssumme)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Honorarrange</dt>
          <dd className="text-lg font-medium">
            {honorarMin === undefined || honorarMax === undefined
              ? '—'
              : `${formatiereAggregat(honorarMin)} – ${formatiereAggregat(honorarMax)}`}
          </dd>
        </div>
      </dl>
      <Button type="button" onClick={erzeuge} disabled={!vollstaendig || laeuft}>
        {laeuft ? 'Offerte wird erzeugt …' : 'Offerte generieren'}
      </Button>
    </section>
  );
}
