/**
 * Kachelübersicht der Projekte (Design-Spec §2/§3). Die Kennung (UUID) ist rein
 * technisch und dient nur der Verlinkung — Menschen identifizieren ein Projekt über
 * Adresse und Datum, nicht über die Kennung, darum steht sie nirgends als Text.
 *
 * Ein schemawidriges Artefakt wird GEKENNZEICHNET, nicht teilweise dargestellt (I-24,
 * analog OffertenListe).
 */
import Link from 'next/link';
import type { Route } from 'next';
import type { ProjektEintrag } from '../server/projekt-ablage.js';

export interface ProjektKachelnProps {
  readonly eintraege: readonly ProjektEintrag[];
}

function datum(iso: string): string {
  return iso === '' ? '—' : new Date(iso).toLocaleDateString('de-CH');
}

export function ProjektKacheln({ eintraege }: ProjektKachelnProps) {
  if (eintraege.length === 0) {
    return <p className="text-muted-foreground">Noch kein Projekt angelegt.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {eintraege.map((e) => (
        <li key={e.id} className="rounded-lg border border-border p-4">
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
              <div className="mb-3 aspect-[4/3] rounded bg-muted" aria-hidden="true" />
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
