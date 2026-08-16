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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'artifacts/coverage',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.d.ts'],
    },
  },
});
