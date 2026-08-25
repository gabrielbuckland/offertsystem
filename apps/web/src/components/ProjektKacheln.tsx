/**
 * Kachelübersicht der Projekte (Design-Spec §2/§3). Die Kennung (UUID) ist rein
 * technisch und dient nur der Verlinkung — Menschen identifizieren ein Projekt über
 * Adresse und Datum, nicht über die Kennung, darum steht sie nirgends als Text.
 *
 * Ein schemawidriges Artefakt wird GEKENNZEICHNET, nicht teilweise dargestellt (I-24).
 */
import Link from 'next/link';
import type { Route } from 'next';
import { Building2 } from 'lucide-react';
import type { ProjektEintrag } from '../server/projekt-ablage.js';
import { LeererZustand } from './ui/leerer-zustand.js';

export interface ProjektKachelnProps {
  readonly eintraege: readonly ProjektEintrag[];
  // Die Aktion (Dialog-Auslöser) gehört der Seite, nicht dieser Komponente — sie
  // müsste sonst `NeuesProjekt` importieren und würde damit Darstellung und Formular
  // koppeln, obwohl beide unabhängig bleiben sollen.
  readonly leerAktion?: React.ReactNode;
}

function datum(iso: string): string {
  return iso === '' ? '—' : new Date(iso).toLocaleDateString('de-CH');
}

export function ProjektKacheln({ eintraege, leerAktion }: ProjektKachelnProps) {
  if (eintraege.length === 0) {
    return (
      <LeererZustand
        titel="Noch kein Projekt angelegt"
        beschreibung="Legen Sie das erste Projekt an, um mit der Bewertung zu beginnen."
        aktion={leerAktion}
      />
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {eintraege.map((e) => (
        <li key={e.id}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
          {e.fehlerhaft ? (
            // `e.datei` bewusst NICHT gezeigt: Der Dateiname traegt die UUID
            // (`${id}.json`, siehe projekt-ablage.ts) und wuerde die Kennung genau an
            // der Stelle sichtbar machen, an der die Regel (Spec §2/§3) am ehesten
            // uebersehen wird.
            <p className="text-muted-foreground">
              Projekt nicht lesbar — Datei muss geprueft werden.
            </p>
          ) : (
            <Link href={`/projekte/${e.id}` as Route} className="block">
              <div className="mb-3 flex h-24 items-center justify-center rounded bg-muted text-muted-foreground">
                <Building2 aria-hidden="true" />
              </div>
              <span className="block font-medium">{e.adresse}</span>
              <span className="block text-sm text-muted-foreground">
                {e.anzahlEinheiten} Einheiten · {datum(e.geaendertAm)}
              </span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
