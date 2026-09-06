// Schreibt artifacts/coverage/latest.json als Zeiger auf den juengsten Abdeckungslauf (PE-18).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERZEICHNIS = join('artifacts', 'coverage');
const ZUSAMMENFASSUNG = join(VERZEICHNIS, 'coverage-summary.json');

if (!existsSync(ZUSAMMENFASSUNG)) {
  console.error(
    `${ZUSAMMENFASSUNG} fehlt. Der Zeiger wird nur nach einem erfolgreichen `
    + 'Abdeckungslauf geschrieben; bitte `vitest run --coverage` ausfuehren.',
  );
  process.exit(1);
}

interface Gesamt {
  readonly lines: { readonly pct: number };
  readonly statements: { readonly pct: number };
  readonly branches: { readonly pct: number };
  readonly functions: { readonly pct: number };
}

const zusammenfassung = JSON.parse(readFileSync(ZUSAMMENFASSUNG, 'utf8')) as {
  readonly total: Gesamt;
};

writeFileSync(
  join(VERZEICHNIS, 'latest.json'),
  `${JSON.stringify({
    art: 'coverage',
    erzeugtAm: new Date().toISOString(),
    datei: 'coverage-summary.json',
    kennzahlen: {
      zeilen: zusammenfassung.total.lines.pct,
      anweisungen: zusammenfassung.total.statements.pct,
      zweige: zusammenfassung.total.branches.pct,
      funktionen: zusammenfassung.total.functions.pct,
    },
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Zeiger geschrieben: ${join(VERZEICHNIS, 'latest.json')}`);
