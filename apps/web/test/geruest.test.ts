/**
 * Keine Formel. Belegt das Next.js-Geruest (PE-19, PE-13).
 *
 * P1 hat die Skripte `build`, `dev` und `pdf:smoke` sowie das Alias `@/*`
 * ausdruecklich an P4 verwiesen (P1-O-03). Dieser Test haelt fest, dass sie hier
 * eingeloest sind — ohne sie waere die Anwendung nach Abschluss aller fuenf Plaene
 * nicht startbar und kein Route Handler lauffaehig.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const web = JSON.parse(readFileSync('apps/web/package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};
const wurzel = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts?: Record<string, string>;
};
const tsconfig = JSON.parse(readFileSync('apps/web/tsconfig.json', 'utf8')) as {
  compilerOptions?: { paths?: Record<string, string[]>; jsx?: string };
};

describe('Next.js-Geruest (PE-19, PE-13)', () => {
  it('deklariert next und react als Laufzeitabhaengigkeiten', () => {
    expect(web.dependencies?.['next']).toBeDefined();
    expect(web.dependencies?.['react']).toBeDefined();
    expect(web.dependencies?.['react-dom']).toBeDefined();
  });

  it('haelt die drei von P1 an diesen Plan verwiesenen Skripte bereit', () => {
    for (const name of ['build', 'dev', 'pdf:smoke']) {
      expect(wurzel.scripts?.[name], `Wurzelskript ${name} fehlt`).toBeDefined();
    }
  });

  it('loest @/* auf src/* auf, und zwar nur in apps/web', () => {
    expect(tsconfig.compilerOptions?.paths?.['@/*']).toEqual(['./src/*']);
    expect(tsconfig.compilerOptions?.jsx).toBe('react-jsx');
    const basis = JSON.parse(readFileSync('tsconfig.base.json', 'utf8')) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    expect(basis.compilerOptions?.paths?.['@/*']).toBeUndefined();
  });

  it('deklariert Tailwind und TanStack Table und bindet ein Stylesheet ein', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> };
    const alle = { ...manifest.dependencies, ...manifest.devDependencies };

    expect(alle['tailwindcss']).toBeDefined();
    expect(alle['@tanstack/react-table']).toBeDefined();

    const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
    expect(layout).toContain('globals.css');
  });
});
