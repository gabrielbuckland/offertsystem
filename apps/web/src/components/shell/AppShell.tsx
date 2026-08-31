import Link from 'next/link';
import type { Route } from 'next';

/**
 * Umschliesst nur die Gruppe (anwendung); Offert-Routen bleiben aussen vor (US-10).
 *
 * Kein eigener Navigationspunkt «Projekte»: Der Logo-Link fuehrt bereits auf die
 * Projektuebersicht, und `Brotkrume` liefert je Seite den Rueckweg dorthin — ein
 * zweiter, staendig sichtbarer Link auf dieselbe Route waere redundant.
 */
export function AppShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-6 px-8">
          <Link href={'/projekte' as Route} className="font-semibold">Offertsystem</Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-8 py-8">{children}</div>
    </div>
  );
}
