import { defineConfig } from 'vitest/config';

// Wurzelkonfiguration ausschliesslich fuer die Abdeckungsmessung: Coverage-Optionen wirken
// wurzelweit und lassen sich nicht je Workspace-Projekt setzen. Reporter `json-summary` und
// festes `reportsDirectory` erzeugen `artifacts/coverage/coverage-summary.json`, die vom
// Evaluationssammler fuer Kapitel 6 eingelesen wird.
export default defineConfig({
  test: {
    // Auch auf der Wurzel gesetzt: Findet ein Lauf in *keinem* Projekt eine Testdatei
    // (z. B. `test:contract` ohne vorhandene Contract-Tests), bricht Vitest sonst mit
    // Code 1 ab, obwohl das erwartbar ist.
    passWithNoTests: true,
    // Laeuft bei JEDEM Lauf mit (Spec 06 §8.2); steht hier statt in der Workspace-Datei,
    // weil Reporter wurzelweit wirken.
    reporters: ['default', './tools/eval/report/vitest-reporter.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'artifacts/coverage',
      // .tsx gehoert zur Messung: Ohne die Endung blieben 52 Komponentendateien
      // (u. a. OfferteDokument.tsx) unerfasst und unausgewiesen (F-060).
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: ['**/index.ts', '**/*.d.ts'],
    },
  },
});
