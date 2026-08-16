import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const wurzel = fileURLToPath(new URL('.', import.meta.url));

const alias = {
  '@offert/core': `${wurzel}packages/core/src/index.ts`,
  '@offert/pricehubble': `${wurzel}packages/pricehubble/src/index.ts`,
  '@offert/offer': `${wurzel}packages/offer/src/index.ts`,
};

/**
 * Alle Projekte lesen `test/**` und erfassen `.ts` UND `.tsx` (PE-12). Ein reines
 * `.ts`-Muster liesse Komponententests zusammen mit passWithNoTests lautlos
 * ausfallen — `verify` waere gruen ohne Nachweis.
 */
const MUSTER = 'test/**/*.test.{ts,tsx}';

/** Zentral gesetzt, damit MSW und onUnhandledRequest: 'error' fuer beide
 *  netzberuehrenden Projekte greifen (AK-07, PE-12). */
const MSW_VORBEREITUNG = `${wurzel}packages/pricehubble/test/setup/msw.ts`;

/** Setzt Seed und numRuns von fast-check und schreibt die Nachweisartefakte (PE-18). */
const PROPERTY_VORBEREITUNG = `${wurzel}packages/core/test/property/globalSetup.ts`;

interface ProjektOptionen {
  readonly name: string;
  readonly root: string;
  readonly include: readonly string[];
  readonly exclude?: readonly string[];
  readonly setupFiles?: readonly string[];
  readonly globalSetup?: string;
}

const projekt = (optionen: ProjektOptionen) => ({
  resolve: { alias },
  test: {
    name: optionen.name,
    root: optionen.root,
    include: [...optionen.include],
    exclude: [...(optionen.exclude ?? []), '**/node_modules/**', '**/dist/**'],
    ...(optionen.setupFiles === undefined ? {} : { setupFiles: [...optionen.setupFiles] }),
    ...(optionen.globalSetup === undefined ? {} : { globalSetup: optionen.globalSetup }),
    environment: 'node' as const,
    passWithNoTests: true,
  },
});

export default defineWorkspace([
  projekt({
    name: 'core',
    root: './packages/core',
    include: [MUSTER, 'test/**/*.property.test.ts'],
    globalSetup: PROPERTY_VORBEREITUNG,
    setupFiles: [`${wurzel}packages/core/test/property/setup.ts`],
  }),
  projekt({
    name: 'pricehubble',
    root: './packages/pricehubble',
    include: [MUSTER],
    exclude: ['test/contract/**'],
    setupFiles: [MSW_VORBEREITUNG],
  }),
  projekt({ name: 'offer', root: './packages/offer', include: [MUSTER] }),
  projekt({ name: 'web', root: './apps/web', include: [MUSTER] }),
  projekt({
    name: 'contract',
    root: './packages/pricehubble',
    include: ['test/contract/**/*.test.{ts,tsx}'],
    setupFiles: [MSW_VORBEREITUNG],
  }),
  projekt({ name: 'tools', root: './tools', include: [MUSTER] }),
]);
