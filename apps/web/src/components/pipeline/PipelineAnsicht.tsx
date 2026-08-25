/**
 * Zustandslose Kartenreihe der fuenf Berechnungsstufen (US-09/A-10). Das Skelett — fuenf
 * Karten, Pfeile dazwischen — ist fix; jede Karteninhalt kommt ausschliesslich aus
 * `bauePipelineDaten`, das ueber die Konfiguration bzw. eine Herleitung iteriert. Im Modus
 * `konfiguration` (Einstellungsbereich) fuehrt jede Karte in ihren Editor; im Modus `projekt`
 * (Projektseite) zeigen dieselben Karten die Zwischenwerte des Projekts und verweisen nur
 * dezent auf die Einstellungen. Rein darstellend: kein State, kein `'use client'`.
 */
import type { Route } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import type { PipelineStufe } from './pipeline-daten.js';

export interface PipelineAnsichtProps {
  readonly stufen: readonly PipelineStufe[];
  readonly modus: 'konfiguration' | 'projekt';
}

function PipelineKarte({ stufe, modus }: { readonly stufe: PipelineStufe; readonly modus: 'konfiguration' | 'projekt' }) {
  return (
    <div className="min-w-56 rounded-lg border border-border bg-card p-3">
      <p className="mb-2 font-medium">
        Stufe {stufe.nr} · {stufe.titel}
      </p>
      <dl className="space-y-1 text-sm">
        {stufe.zeilen.map((zeile) => (
          <div key={zeile.beschriftung} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{zeile.beschriftung}</dt>
            <dd className="tabular-nums">
              {zeile.wert}
              {zeile.herkunft !== undefined && (
                <span className="ml-1 text-muted-foreground">
                  ({zeile.herkunft === 'projekt' ? 'projektbezogen' : 'firmenweit'})
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {stufe.balken !== undefined && (
        <div className="mt-2 space-y-1.5">
          {stufe.balken.map((balken) => (
            <div key={balken.beschriftung}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{balken.beschriftung}</span>
                <span className="tabular-nums">{balken.wert}</span>
              </div>
              <div className="h-1.5 w-full rounded bg-primary/20">
                <div
                  className="h-1.5 rounded bg-primary"
                  style={{ width: `${Math.round(balken.anteil * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 border-t border-border pt-2 text-sm">
        {modus === 'konfiguration' ? (
          <Link href={stufe.editorPfad as Route} className="text-primary">
            Bearbeiten
          </Link>
        ) : (
          <Link href={stufe.editorPfad as Route} className="text-muted-foreground">
            Parameter in Einstellungen
          </Link>
        )}
      </div>
    </div>
  );
}

export function PipelineAnsicht({ stufen, modus }: PipelineAnsichtProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {stufen.map((stufe, index) => (
        <Fragment key={stufe.nr}>
          {index > 0 && (
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
          )}
          <PipelineKarte stufe={stufe} modus={modus} />
        </Fragment>
      ))}
    </div>
  );
}
