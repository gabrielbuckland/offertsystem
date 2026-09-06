// Kennung (UUID) ist rein technisch (Verlinkung), steht nirgends als Text.
// Schemawidriges Artefakt wird GEKENNZEICHNET, nicht teilweise dargestellt (I-24).
import Link from 'next/link';
import type { Route } from 'next';
import { Building2 } from 'lucide-react';
import type { ProjektEintrag } from '../server/projekt-ablage.js';
import { LeererZustand } from './ui/leerer-zustand.js';

export interface ProjektKachelnProps {
  readonly eintraege: readonly ProjektEintrag[];
  // Dialog-Ausloeser gehoert der Seite, nicht dieser Komponente (sonst Darstellung/Formular gekoppelt).
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
            // e.datei bewusst NICHT gezeigt: Dateiname traegt die UUID.
            <p className="text-muted-foreground">
              Projekt nicht lesbar. Die Datei muss geprüft werden.
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
