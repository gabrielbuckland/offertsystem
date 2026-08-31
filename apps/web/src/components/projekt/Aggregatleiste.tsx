'use client';
import { formatiereAggregat, formatiereScore } from '@offert/offer';
import { Button } from '../ui/button.js';
import { Hinweis } from '../ui/hinweis.js';

export interface AggregatleisteProps {
  readonly verkaufssumme: number | undefined;
  readonly honorarMin: number | undefined;
  readonly honorarMax: number | undefined;
  readonly aufwandindikator: number | undefined;
  readonly aufwandindikatorUebersteuert?: boolean;
  // E-04: nur bei Verkaufssumme ausserhalb der Staffel gesetzt; Text kommt fertig
  // uebersetzt aus der Route.
  readonly honorarAbbruchMeldung?: string;
  readonly erzeuge: () => void;
  readonly laeuft: boolean;
  readonly speichernLaeuft: boolean;
  readonly berechnungLaeuft: boolean;
  readonly zeigeRechenweg: () => void;
}

// Verortet D zwischen seinen fachlichen Polen 0 (gering) und 1 (hoch), Zuordnung monoton
// (I-15/I-16). Der Fuellstand wird nur fuers Zeichnen begrenzt: D kann ausserhalb [0, 1]
// liegen (E-04), der angezeigte Zahlwert bleibt ehrlich.
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

// I-24: fehlendes Aggregat wird als solches ausgewiesen, nicht als Null (Null ist ein
// gueltiger Rechenwert). Sticky Fusszeile (Design-Spec §4).
export function Aggregatleiste(
  {
    verkaufssumme, honorarMin, honorarMax, aufwandindikator, aufwandindikatorUebersteuert,
    honorarAbbruchMeldung,
    erzeuge, laeuft, speichernLaeuft, berechnungLaeuft, zeigeRechenweg,
  }: AggregatleisteProps,
) {
  const vollstaendig = verkaufssumme !== undefined
    && honorarMin !== undefined && honorarMax !== undefined;

  // Waehrend Speichern/Neuberechnung darf der zuletzt angezeigte, jetzt veraltete Stand
  // nicht in eine Offerte ueberfuehrt werden koennen.
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
            // E-04 blockiert das Ziel (keine Honorarrange/Offerte), daher `rolle="alert"`
            // trotz nicht-roter Warnfarbe statt der stillen `status`-Rolle.
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
