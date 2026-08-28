'use client';
import { formatiereAggregat, formatiereScore } from '@offert/offer/src/format/de-ch.js';
import { Button } from '../ui/button.js';
import { Hinweis } from '../ui/hinweis.js';

export interface AggregatleisteProps {
  readonly verkaufssumme: number | undefined;
  readonly honorarMin: number | undefined;
  readonly honorarMax: number | undefined;
  readonly aufwandindikator: number | undefined;
  /** Wahr, wenn D vom Vermarkter uebersteuert ist (Basisinformationen) — der Ausweis
   *  unterscheidet den gesetzten vom abgeleiteten Wert. */
  readonly aufwandindikatorUebersteuert?: boolean;
  /** Nur gesetzt bei E-04 (Verkaufssumme ausserhalb der Staffel) — Text kommt fertig
   *  uebersetzt aus der Route, diese Komponente uebersetzt nicht nach. */
  readonly honorarAbbruchMeldung?: string;
  readonly erzeuge: () => void;
  readonly laeuft: boolean;
  readonly speichernLaeuft: boolean;
  readonly berechnungLaeuft: boolean;
  readonly zeigeRechenweg: () => void;
}

/**
 * Eine nackte Kommazahl sagt dem Vermarkter nichts (Rueckmeldung Auftraggeber
 * 2026-08-28): Die kleine Skala verortet D zwischen seinen fachlichen Polen 0 (gering)
 * und 1 (hoch), ohne Schwellen zu erfinden — die Zuordnung ist monoton (I-15/I-16), mehr
 * behauptet die Darstellung nicht. Der Fuellstand wird nur fuers Zeichnen begrenzt: Der
 * E-04-Teilerfolg kann ein D ausserhalb von [0, 1] anzeigen, der Zahlwert bleibt ehrlich.
 */
function AufwandindikatorSkala({ wert }: { readonly wert: number }) {
  const anteil = Math.min(1, Math.max(0, wert));
  return (
    <div className="mt-1 w-28">
      <div className="h-1 rounded-full bg-primary/15">
        <div
          className="h-1 rounded-full bg-primary"
          style={{ width: `${String(Math.round(anteil * 100))}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] leading-3 text-muted-foreground">
        <span>gering</span>
        <span>hoch</span>
      </div>
    </div>
  );
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
    verkaufssumme, honorarMin, honorarMax, aufwandindikator, aufwandindikatorUebersteuert,
    honorarAbbruchMeldung,
    erzeuge, laeuft, speichernLaeuft, berechnungLaeuft, zeigeRechenweg,
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
          <div title="Aufwandintensität der Vermarktung. Skaliert die Honorarrange innerhalb ihrer Stufe.">
            <dt className="text-sm text-muted-foreground">
              Aufwandindikator D{aufwandindikatorUebersteuert === true ? ' (übersteuert)' : ''}
            </dt>
            <dd className="text-lg font-medium">
              {aufwandindikator === undefined ? '—' : formatiereScore(aufwandindikator)}
            </dd>
            {aufwandindikator !== undefined && <AufwandindikatorSkala wert={aufwandindikator} />}
          </div>
        </dl>
        <Button type="button" variant="ghost" onClick={zeigeRechenweg}>
          Rechenweg anzeigen
        </Button>
        <div className="flex flex-col items-end gap-1">
          {honorarAbbruchMeldung !== undefined && (
            // `rolle="alert"` unabhaengig von der (fuer den Auftraggeber bewusst nicht
            // roten) Warnfarbe: E-04 ist kein Eingabefehler, blockiert aber das Ziel
            // (keine Honorarrange, keine Offerte) und verlangt deshalb sofortige
            // Aufmerksamkeit statt der stillen `status`-Rolle der Art „warnung“.
            <Hinweis art="warnung" rolle="alert">{honorarAbbruchMeldung}</Hinweis>
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
