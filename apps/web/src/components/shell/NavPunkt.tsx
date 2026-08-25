'use client';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils.js';

/**
 * Aktiv-Markierung braucht den Pfad und damit einen Client-Hook; alles Uebrige der
 * Shell bleibt Server-Komponente (Spec §2). Praefix-Vergleich, damit
 * /projekte/[id] den Punkt «Projekte» aktiv haelt.
 */
export function NavPunkt({ href, children }: {
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  const pfad = usePathname();
  // `usePathname` liefert ausserhalb des Next-Router-Kontexts `null` (React-Default fuer
  // einen leeren Context, z. B. bei `renderToStaticMarkup` in Tests) — Optional Chaining
  // haelt die Markierung dann inaktiv statt abzustuerzen.
  const aktiv = pfad === href || (pfad?.startsWith(`${href}/`) ?? false);
  return (
    <Link href={href as Route}
          aria-current={aktiv ? 'page' : undefined}
          className={cn(
            'border-b-2 px-1 pb-1 text-sm transition-colors',
            aktiv
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}>
      {children}
    </Link>
  );
}
