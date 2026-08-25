import Link from 'next/link';
import type { Route } from 'next';

export function Brotkrume({ stufen }: {
  readonly stufen: readonly { readonly beschriftung: string; readonly href?: string }[];
}) {
  return (
    <nav aria-label="Pfad" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {stufen.map((s, i) => (
          <li key={`${s.beschriftung}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">›</span>}
            {s.href !== undefined
              ? <Link href={s.href as Route} className="hover:text-foreground">{s.beschriftung}</Link>
              : <span aria-current="page" className="text-foreground">{s.beschriftung}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
