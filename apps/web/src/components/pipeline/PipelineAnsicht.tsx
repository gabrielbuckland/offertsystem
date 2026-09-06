// US-09/A-10: rein darstellend, gerechnet wird hier nichts (I-24).
import type { Route } from 'next';
import Link from 'next/link';
import type { PipelineAbschnitt, PipelineStufe, PipelineZeile } from './pipeline-daten.js';

export interface PipelineAnsichtProps {
  readonly stufen: readonly PipelineStufe[];
}

function Herkunftszeichen({ herkunft }: { readonly herkunft: 'firmenweit' | 'projekt' }) {
  return (
    <span
      className={`rounded-full border px-1.5 py-px text-[10px] leading-4 ${
        herkunft === 'projekt'
          ? 'border-accent-foreground/30 bg-accent text-accent-foreground'
          : 'border-border bg-muted text-muted-foreground'}`}
    >
      {herkunft === 'projekt' ? 'projektbezogen' : 'firmenweit'}
    </span>
  );
}

function Formelzeile({ zeile }: { readonly zeile: PipelineZeile }) {
  return (
    <div className={zeile.hervorgehoben === true
      ? 'rounded-md border border-accent-foreground/20 bg-accent/60 px-3 py-2'
      : 'px-3 py-1.5'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
        <dt className={`flex items-center gap-2 text-sm ${
          zeile.hervorgehoben === true ? 'font-medium' : 'text-muted-foreground'}`}
        >
          {zeile.beschriftung}
          {zeile.herkunft !== undefined && <Herkunftszeichen herkunft={zeile.herkunft} />}
        </dt>
        <dd className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {zeile.ausdruck !== undefined && (
            <span className="font-mono text-[13px] text-muted-foreground">
              {zeile.ausdruck}
              <span className="mx-1">=</span>
            </span>
          )}
          <span className={`tabular-nums ${zeile.hervorgehoben === true ? 'font-semibold' : 'font-medium'}`}>
            {zeile.wert}
          </span>
        </dd>
      </div>
      {zeile.anteil !== undefined && (
        <div className="mt-1.5 h-1 w-full max-w-56 rounded-full bg-primary/15">
          <div
            className="h-1 rounded-full bg-primary"
            style={{ width: `${String(Math.round(Math.min(1, Math.max(0, zeile.anteil)) * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Abschnitt({ abschnitt }: { readonly abschnitt: PipelineAbschnitt }) {
  return (
    <div>
      {abschnitt.titel !== undefined && (
        <h4 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {abschnitt.titel}
        </h4>
      )}
      {abschnitt.formeln !== undefined && (
        <div className="mb-2 space-y-0.5 px-3">
          {abschnitt.formeln.map((formel) => (
            <p key={formel} className="font-mono text-[13px] text-muted-foreground">{formel}</p>
          ))}
        </div>
      )}
      {abschnitt.zeilen !== undefined && (
        <dl className="divide-y divide-border/60">
          {abschnitt.zeilen.map((zeile) => (
            <Formelzeile key={zeile.beschriftung} zeile={zeile} />
          ))}
        </dl>
      )}
      {abschnitt.tabelle !== undefined && (
        <div className="mx-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                {abschnitt.tabelle.kopf.map((kopf, i) => (
                  <th
                    key={kopf}
                    className={`px-3 py-2 font-medium text-muted-foreground ${
                      abschnitt.tabelle!.ausrichtung[i] === 'rechts' ? 'text-right' : ''}`}
                  >
                    {kopf}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {/* Index als Schluessel ok: Reihenfolge/Anzahl sind durch die Herleitung fixiert. */}
              {abschnitt.tabelle.zeilen.map((zeile, zi) => (
                <tr key={zi} className="align-top">
                  {zeile.map((zelle, si) => (
                    <td
                      key={si}
                      className={`whitespace-pre-line px-3 py-2 tabular-nums ${
                        abschnitt.tabelle!.ausrichtung[si] === 'rechts' ? 'text-right' : ''}`}
                    >
                      {zelle}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stufe({ stufe, letzte }: { readonly stufe: PipelineStufe; readonly letzte: boolean }) {
  return (
    <section aria-label={`Stufe ${String(stufe.nr)}: ${stufe.titel}`} className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {stufe.nr}
        </span>
        {!letzte && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
      </div>
      <div className={`min-w-0 flex-1 ${letzte ? '' : 'pb-8'}`}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-semibold">{stufe.titel}</h3>
          <Link
            href={stufe.editorPfad as Route}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Parameter in Einstellungen
          </Link>
        </div>
        <p className="mb-3 max-w-prose text-sm text-muted-foreground">{stufe.zweck}</p>
        <div className="space-y-4 rounded-lg border border-border bg-card py-2">
          {stufe.abschnitte.map((abschnitt, i) => (
            <Abschnitt key={i} abschnitt={abschnitt} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function PipelineAnsicht({ stufen }: PipelineAnsichtProps) {
  return (
    <div>
      {stufen.map((stufe, index) => (
        <Stufe key={stufe.nr} stufe={stufe} letzte={index === stufen.length - 1} />
      ))}
    </div>
  );
}
