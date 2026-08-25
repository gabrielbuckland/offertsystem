'use client';
import { formatiereAggregat, formatiereScore } from '@offert/offer/src/format/de-ch.js';
import { Button } from '../ui/button.js';
import { Hinweis } from '../ui/hinweis.js';

export interface AggregatleisteProps {
  readonly verkaufssumme: number | undefined;
  readonly honorarMin: number | undefined;
  readonly honorarMax: number | undefined;
  readonly aufwandindikator: number | undefined;
  /** Nur gesetzt bei E-04 (Verkaufssumme ausserhalb der Staffel) — Text kommt fertig
   *  uebersetzt aus der Route, diese Komponente uebersetzt nicht nach. */
  readonly honorarAbbruchMeldung?: string;
  readonly erzeuge: () => void;
  readonly laeuft: boolean;
  readonly speichernLaeuft: boolean;
  readonly berechnungLaeuft: boolean;
  readonly rechenwegOffen: boolean;
  readonly schalteRechenweg: () => void;
}

/**
 * Ein fehlendes Aggregat wird als solches ausgewiesen und nicht als Null dargestellt:
 * Null ist ein gueltiger Rechenwert, «noch nicht berechnet» ist keiner (I-24).
 *
 * Sticky Fusszeile (Design-Spec §4): bleibt beim Scrollen der langen Einheitentabelle
 * sichtbar, damit Verkaufssumme/Honorarrange/Offert-Schaltflaeche immer erreichbar sind.
 */
export function Aggregatleiste(
  {
    verkaufssumme, honorarMin, honorarMax, aufwandindikator, honorarAbbruchMeldung,
    erzeuge, laeuft, speichernLaeuft, berechnungLaeuft, rechenwegOffen, schalteRechenweg,
  }: AggregatleisteProps,
) {
  const vollstaendig = verkaufssumme !== undefined
    && honorarMin !== undefined && honorarMax !== undefined;

  // Schliesst die 400-ms-Luecke (docs/offene-punkte-projektansicht.md): waehrend
  // Speichern/Neuberechnung darf der zuletzt angezeigte, jetzt veraltete Stand nicht
  // in eine Offerte ueberfuehrt werden koennen — die Begruendung steht dabei als Text.
  const gesperrtWeil = speichernLaeuft || berechnungLaeuft
    ? 'Änderungen werden gespeichert und neu berechnet …'
    : !vollstaendig ? 'Es liegt noch kein vollständiges Ergebnis vor.' : undefined;

  return (
    <section className="sticky bottom-0 z-10 -mx-8 border-t border-border bg-background/95 px-8 py-4 backdrop-blur">
      <div className="flex items-end justify-between gap-6">
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
              {honorarAbbruchMeldung !== undefined
                || honorarMin === undefined || honorarMax === undefined
                ? '—'
                : `${formatiereAggregat(honorarMin)} – ${formatiereAggregat(honorarMax)}`}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Aufwandindikator D</dt>
            <dd className="text-lg font-medium">
              {aufwandindikator === undefined ? '—' : formatiereScore(aufwandindikator)}
            </dd>
          </div>
        </dl>
        <Button type="button" variant="ghost" onClick={schalteRechenweg}>
          {rechenwegOffen ? 'Rechenweg ausblenden' : 'Rechenweg anzeigen'}
        </Button>
        <div className="flex flex-col items-end gap-1">
          {honorarAbbruchMeldung !== undefined && (
            // `role="alert"` unabhaengig von der (fuer den Auftraggeber bewusst nicht
            // roten) Warnfarbe: E-04 ist kein Eingabefehler, verlangt aber sofortige
            // Aufmerksamkeit — die Honorarrange fehlt, bis die Konfiguration passt.
            <div role="alert">
              <Hinweis art="warnung">{honorarAbbruchMeldung}</Hinweis>
            </div>
          )}
          <Button type="button" onClick={erzeuge} disabled={gesperrtWeil !== undefined || laeuft}>
            {laeuft ? 'Offerte wird erzeugt …' : 'Offerte generieren'}
          </Button>
          <p className="text-xs text-muted-foreground">{gesperrtWeil}</p>
        </div>
      </div>
    </section>
  );
}
