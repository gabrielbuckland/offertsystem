import { defineConfig } from 'vitest/config';

/**
 * Wurzelkonfiguration ausschliesslich fuer die Abdeckungsmessung. Coverage-
 * Optionen wirken wurzelweit und koennen nicht je Workspace-Projekt gesetzt
 * werden.
 *
 * Der Reporter `json-summary` und das feste `reportsDirectory` erzeugen
 * `artifacts/coverage/coverage-summary.json` — genau die Datei, die der Sammler
 * des Evaluationsplans einliest. Ohne sie bliebe die Abdeckungszeile in
 * Kapitel 6 leer.
 */
export default defineConfig({
  test: {
    /**
     * Auch auf der Wurzel gesetzt, nicht nur je Projekt: Findet ein Lauf in
     * *keinem* Projekt eine Testdatei, greift die Projektoption nicht mehr und
     * Vitest bricht mit Code 1 ab. Genau das ist `npm run test:contract`,
     * solange P3 die Contract-Tests noch nicht geschrieben hat — `verify` waere
     * rot, obwohl planmaessig nichts vorliegt.
     */
    passWithNoTests: true,
    /**
     * Der Testartefakt-Reporter laeuft bei JEDEM Lauf mit. Damit gibt es keinen Pfad,
     * auf dem ein Testergebnis in den Anhang gelangt, ohne durch `tests.json` gelaufen
     * zu sein (Spec 06 §8.2). Er steht hier und nicht in der Workspace-Datei, weil
     * Reporter wurzelweit wirken.
     */
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
