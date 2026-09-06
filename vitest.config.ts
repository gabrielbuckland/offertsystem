import { defineConfig } from 'vitest/config';

// Coverage-Optionen wirken nur wurzelweit, nicht je Workspace-Projekt; reportsDirectory
// erzeugt artifacts/coverage/coverage-summary.json fuer den Evaluationssammler (Kap. 6).
export default defineConfig({
  test: {
    // passWithNoTests auch auf der Wurzel: sonst bricht z. B. test:contract ohne
    // vorhandene Contract-Tests mit Code 1 ab, obwohl das erwartbar ist.
    passWithNoTests: true,
    // Reporter wirken wurzelweit, daher hier statt in der Workspace-Datei (Spec 06 §8.2).
    reporters: ['default', './tools/eval/report/vitest-reporter.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'artifacts/coverage',
      // F-060: .tsx noetig, sonst blieben Komponentendateien (z. B. OfferteDokument.tsx) unerfasst.
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: ['**/index.ts', '**/*.d.ts'],
    },
  },
});
