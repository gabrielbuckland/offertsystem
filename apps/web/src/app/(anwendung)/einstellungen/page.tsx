import type { OffertKonfiguration } from '@offert/core';
import { bauePipelineDaten } from '../../../components/pipeline/pipeline-daten.js';
import { PipelineAnsicht } from '../../../components/pipeline/PipelineAnsicht.js';
import { Brotkrume } from '../../../components/shell/Brotkrume.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card.js';
import { holeLaufzeit } from '../../../server/laufzeit.js';

export const dynamic = 'force-dynamic';

export default async function EinstellungenSeite() {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Einstellungen</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }
  // `rohKonfiguration` ist typerhalten dieselbe `OffertKonfiguration`, die der Lader
  // validiert hat (laufzeit.ts baut sie ueber `as unknown as Record<string, unknown>`
  // ab) — der Rueckweg spiegelt das (PE-01: die Pruefung, nicht diese Seite, buergt
  // fuer die Form).
  const basis = laufzeit.wert.rohKonfiguration as unknown as OffertKonfiguration;
  const api = basis.api;

  return (
    <main>
      <Brotkrume stufen={[{ beschriftung: 'Einstellungen' }]} />
      <h1 className="mb-6 text-2xl font-semibold">Einstellungen</h1>
      <PipelineAnsicht modus="konfiguration" stufen={bauePipelineDaten(basis)} />

      {/* Rollentrennung (US-08, Spec §6): Die API-Anbindung ist Betriebsparameter, kein
          Einstellungswert des Auftraggebers. Lesend statt editierbar, weil eine falsch
          gesetzte Basis-URL oder ein zu knapper Timeout nicht durch die Editor-Validierung
          abgefangen wird, sondern erst beim naechsten PriceHubble-Aufruf durchschlaegt —
          das Risiko bleibt bei der IT, die die Konfigurationsdatei direkt pflegt. */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Technische Parameter (API)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-1 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Basis-URL</dt>
              <dd className="tabular-nums">{api.baseUrl}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Timeout (ms)</dt>
              <dd className="tabular-nums">{api.timeoutMs}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Maximale Versuche</dt>
              <dd className="tabular-nums">{api.retry.maxVersuche}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            Diese Werte pflegt die IT direkt in der Konfigurationsdatei.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
