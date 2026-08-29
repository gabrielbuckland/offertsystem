import type { OffertKonfiguration } from '@offert/core';
import { Fragment } from 'react';
import { EinstellungsEditor } from '../../../components/einstellungen/EinstellungsEditor.js';
import { Brotkrume } from '../../../components/shell/Brotkrume.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card.js';
import { holeLaufzeit } from '../../../server/laufzeit.js';
import { BEREICHE, type Bereich } from './bereiche.js';

export const dynamic = 'force-dynamic';

/**
 * Reihenfolge der Pipeline-Stufen (US-09/A-10) fuer die Uebersicht: Stufe 3
 * (Normalisierung) und Stufe 4 (Gewichtung) teilen sich einen Bereich (`faktoren`) — ein
 * Faktor traegt Min/Max UND Gewicht in einem Editor, siehe `FaktorenEditor`. Zwei
 * eingebettete Editoren fuer denselben Bereich haetten zwei unabhaengige Entwuerfe zur
 * Folge (`EinstellungsEditor`-Dateikommentar); deshalb genau EIN Editor pro Bereich,
 * mit dem Stufenlabel, das er inhaltlich abdeckt.
 */
const PIPELINE_REIHENFOLGE: ReadonlyArray<{ readonly stufenLabel: string; readonly bereich: Bereich }> = [
  { stufenLabel: 'Stufe 1 · Eingabe', bereich: 'dossier' },
  { stufenLabel: 'Stufe 2 · Verkaufssumme', bereich: 'preisanpassung' },
  { stufenLabel: 'Stufe 3–4 · Normalisierung & Gewichtung', bereich: 'faktoren' },
  { stufenLabel: 'Stufe 5 · Honorar', bereich: 'honorar' },
];

export default async function EinstellungenSeite() {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Firmeneinstellungen</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }
  const rohKonfiguration = laufzeit.wert.rohKonfiguration;
  // Typerhalten dieselbe `OffertKonfiguration`, die der Lader validiert hat
  // (laufzeit.ts baut sie ueber `as unknown as Record<string, unknown>` ab) — der
  // Rueckweg spiegelt das (PE-01: die Pruefung, nicht diese Seite, buergt fuer die Form).
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
        {/* Offerttext-Vorlage (Spec 2026-08-27 §3) ist kein Pipeline-Bereich wie die
            vier Karten unten (kein Zahlenwert, sondern Fliesstext mit Platzhaltern) —
            deshalb eigene Seite statt eines fuenften inline eingebetteten Editors. */}
        <a href="/einstellungen/vorlage" className="text-sm text-primary underline">
          Offertvorlage bearbeiten
        </a>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Diese Werte gelten für alle neuen und laufenden Projekte, sofern ein Projekt
        sie nicht für sich übersteuert.
      </p>

      {/* Untereinander statt nebeneinander (Rueckmeldung Auftraggeber): Jede Stufe der
          Berechnungs-Pipeline ist hier direkt inline editierbar — kein Umweg mehr ueber
          eine separate Editor-Seite. Die Reihenfolge folgt der Pipeline, ein Pfeil nach
          unten haelt den Fluss sichtbar. */}
      <div className="flex flex-col gap-4">
        {PIPELINE_REIHENFOLGE.map((eintrag, index) => {
          const bereich = BEREICHE[eintrag.bereich];
          return (
            <Fragment key={eintrag.bereich}>
              {index > 0 && (
                <span aria-hidden="true" className="text-center text-muted-foreground">
                  ↓
                </span>
              )}
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">{eintrag.stufenLabel}</p>
                <EinstellungsEditor
                  titel={bereich.titel}
                  zweck={bereich.zweck}
                  bereichPraefix={bereich.praefix}
                  anfang={rohKonfiguration}
                  Editor={bereich.Editor}
                />
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Rollentrennung (US-08, Spec §6): Die API-Anbindung ist Betriebsparameter, kein
          Einstellungswert des Auftraggebers. Lesend statt editierbar, weil eine falsch
          gesetzte Basis-URL oder ein zu knapper Timeout nicht durch die Editor-Validierung
          abgefangen wird, sondern erst beim naechsten PriceHubble-Aufruf durchschlaegt —
          das Risiko bleibt bei der IT, die die Konfigurationsdatei direkt pflegt.
          `cursor-not-allowed` markiert die Werte bewusst als nicht editierbar — im
          Unterschied zu den echten Eingabefeldern der Pipeline-Karten oben, die denselben
          Zeilenaufbau (dt/dd) verwenden koennten, aber tatsaechliche Formularelemente sind. */}
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
