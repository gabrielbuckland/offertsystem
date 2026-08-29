/**
 * Keine Formel. Belegt das Next.js-Geruest (P1-O-03, PE-19, PE-13, US-10).
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
  it('deklariert Laufzeitabhaengigkeiten, Skripte, Pfad-Alias und Stylesheet-Bindung (P1-O-03)', () => {
    expect(web.dependencies?.['next']).toBeDefined();
    expect(web.dependencies?.['react']).toBeDefined();
    expect(web.dependencies?.['react-dom']).toBeDefined();

    for (const name of ['build', 'dev', 'pdf:smoke']) {
      expect(wurzel.scripts?.[name], `Wurzelskript ${name} fehlt`).toBeDefined();
    }

    expect(tsconfig.compilerOptions?.paths?.['@/*']).toEqual(['./src/*']);
    expect(tsconfig.compilerOptions?.jsx).toBe('react-jsx');
    const basis = JSON.parse(readFileSync('tsconfig.base.json', 'utf8')) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    expect(basis.compilerOptions?.paths?.['@/*']).toBeUndefined();

    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> };
    const alle = { ...manifest.dependencies, ...manifest.devDependencies };
    expect(alle['tailwindcss']).toBeDefined();
    expect(alle['@tanstack/react-table']).toBeDefined();

    const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
    expect(layout).toContain('offerte.css');
  });

  it('haelt Tailwind aus den Offert-Routen heraus (US-10, Spec §7)', () => {
    // Quellbasierte Pruefung, kein Rendering: sie pinnt die Strukturentscheidung
    // (Wurzellayout ohne, Gruppenlayout mit globals.css), nicht das gerenderte Ergebnis.
    const wurzel = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
    expect(wurzel).not.toContain('globals.css');

    const anwendung = readFileSync(
      new URL('../src/app/(anwendung)/layout.tsx', import.meta.url), 'utf8',
    );
    expect(anwendung).toContain('globals.css');
  });
});

it('deklariert den vollständigen Tokensatz und keine harten Farben im Button', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  for (const token of [
    '--primary', '--primary-foreground', '--destructive', '--destructive-foreground',
    '--card', '--card-foreground', '--accent', '--accent-foreground',
    '--secondary', '--secondary-foreground',
  ]) {
    expect(css).toContain(`${token}:`);
  }
  const button = readFileSync(
    new URL('../src/components/ui/button.tsx', import.meta.url), 'utf8');
  // Semantisches Token statt fester Palette: `bg-red-600` war der Umweg, weil es kein
  // `--destructive` gab (docs/offene-punkte-projektansicht.md).
  expect(button).not.toContain('bg-red-600');
  expect(button).toContain('bg-destructive');
  expect(button).toContain('bg-primary');
});
