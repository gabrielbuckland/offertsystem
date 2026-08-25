import Link from 'next/link';
import type { Route } from 'next';
import { NavPunkt } from './NavPunkt.js';

/** Umschliesst nur die Gruppe (anwendung); Offert-Routen bleiben aussen vor (US-10). */
export function AppShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-6 px-8">
          <Link href={'/projekte' as Route} className="font-semibold">Offertsystem</Link>
          <nav className="flex items-center gap-4" aria-label="Hauptnavigation">
            <NavPunkt href="/projekte">Projekte</NavPunkt>
            <NavPunkt href="/einstellungen">Einstellungen</NavPunkt>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-8 py-8">{children}</div>
    </div>
  );
}
