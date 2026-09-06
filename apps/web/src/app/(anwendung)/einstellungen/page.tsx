import type { OffertKonfiguration } from '@offert/core';
import { FirmenEinstellungen } from '../../../components/einstellungen/FirmenEinstellungen.js';
import { Brotkrume } from '../../../components/shell/Brotkrume.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card.js';
import { holeLaufzeit } from '../../../server/laufzeit.js';

export const dynamic = 'force-dynamic';

export default async function EinstellungenSeite() {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Firmeneinstellungen</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }
  const rohKonfiguration = laufzeit.wert.rohKonfiguration;
  // Typ bleibt dieselbe bereits validierte `OffertKonfiguration`; der Rueckweg spiegelt
  // das (PE-01: die Pruefung, nicht diese Seite, buergt fuer die Form).
  const api = (rohKonfiguration as unknown as OffertKonfiguration).api;

  return (
    <main>
      <Brotkrume stufen={[
        { beschriftung: 'Projekte', href: '/projekte' },
        { beschriftung: 'Firmeneinstellungen' },
      ]}
      />
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Firmeneinstellungen</h1>
        <a href="/einstellungen/vorlage" className="text-sm text-primary underline">
          Offertvorlage bearbeiten
        </a>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Diese Werte gelten für alle neuen und laufenden Projekte, sofern ein Projekt
        sie nicht für sich übersteuert.
      </p>

      <FirmenEinstellungen anfang={rohKonfiguration} />

      {/* Rollentrennung (US-08): API-Anbindung ist Betriebsparameter, kein Einstellungswert
          des Auftraggebers. Lesend statt editierbar, weil eine falsch gesetzte Basis-URL
          oder ein zu knapper Timeout nicht durch Editor-Validierung abgefangen wird,
          sondern erst beim naechsten PriceHubble-Aufruf durchschlaegt. */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Technische Parameter (API)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="cursor-not-allowed space-y-1 text-sm">
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
