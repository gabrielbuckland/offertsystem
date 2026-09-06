'use client';

// Interner Rechenweg der abgelegten Offerte im selben Dialog wie die Projektansicht.
// Erhaelt nur serialisierbare Stufendaten; aufgebaut werden sie serverseitig in
// rechenweg-offerte-logik.ts aus dem eingefrorenen Artefakt.
import { useState } from 'react';
import { Button } from '../ui/button.js';
import { RechenwegDialog } from '../pipeline/RechenwegDialog.js';
import type { PipelineStufe } from '../pipeline/pipeline-daten.js';
import type { OffertGrundlagen } from './rechenweg-offerte-logik.js';

function Grundlagenzeile({ beschriftung, wert, mono }: {
  readonly beschriftung: string;
  readonly wert: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 px-3 py-1.5">
      <dt className="text-sm text-muted-foreground">{beschriftung}</dt>
      <dd className={`text-sm font-medium ${mono === true ? 'break-all font-mono text-[13px]' : 'tabular-nums'}`}>
        {wert}
      </dd>
    </div>
  );
}

function Berechnungsgrundlagen({ grundlagen }: { readonly grundlagen: OffertGrundlagen }) {
  return (
    <section aria-label="Berechnungsgrundlagen" className="ml-12">
      <h3 className="mb-2 text-base font-semibold">Berechnungsgrundlagen</h3>
      <dl className="divide-y divide-border/60 rounded-lg border border-border bg-card py-2">
        <Grundlagenzeile beschriftung="Erstellt am" wert={grundlagen.erstelltAm} />
        <Grundlagenzeile beschriftung="Konfigurationsversion" wert={grundlagen.konfigVersion} />
        <Grundlagenzeile beschriftung="Prüfsumme der Konfiguration"
                         wert={grundlagen.konfigPruefsumme} mono />
        {grundlagen.bewertungen.map((bewertung) => (
          <Grundlagenzeile
            key={bewertung.typ}
            beschriftung={`Referenzbewertung ${bewertung.typ}`}
            wert={`PriceHubble, ${bewertung.bewertungsdatum}, Konfidenzklasse ${bewertung.konfidenzklasse}`}
          />
        ))}
      </dl>
    </section>
  );
}

export function OffertRechenweg({ stufen, grundlagen }: {
  readonly stufen: readonly PipelineStufe[];
  readonly grundlagen: OffertGrundlagen;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOffen(true)}>
        Rechenweg (intern)
      </Button>
      <RechenwegDialog
        offen={offen}
        schliesse={() => setOffen(false)}
        stufen={stufen}
        untertitel={`Eingefrorener Stand dieser Offerte vom ${grundlagen.erstelltAm}. `
          + 'Spätere Änderungen an Projekt oder Konfiguration wirken hier nicht.'}
        zusatz={<Berechnungsgrundlagen grundlagen={grundlagen} />}
      />
    </>
  );
}
