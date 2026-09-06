// Jede Property meldet ihr Ergebnis als eigene Datei; der Teardown von globalSetup
// verdichtet sie zu properties.json (PE-18). Eigene Dateien statt eines gemeinsamen
// Zustands, weil Vitest die Testdateien in getrennten Prozessen ausfuehrt.
import { writeFileSync } from 'node:fs';
import type { InvariantenId } from '../../src/config/toleranzen.js';

export interface PropertyMeldung {
  readonly id: InvariantenId;
  readonly runs: number;
  readonly pass: boolean;
  readonly gegenbeispiel: string | null;
}

export function haltePropertyFest(meldung: PropertyMeldung): void {
  const verzeichnis = process.env['PROPERTY_LAUF'];
  if (verzeichnis === undefined) return; // Einzellauf ohne globalSetup: kein Artefakt.
  writeFileSync(`${verzeichnis}/roh/${meldung.id}.json`,
    `${JSON.stringify(meldung, null, 2)}\n`);
}

// Fehler wird nach dem Melden unveraendert weitergereicht, damit der Testlauf rot bleibt.
export function pruefeProperty(id: InvariantenId, runs: number, lauf: () => void): void {
  try {
    lauf();
    haltePropertyFest({ id, runs, pass: true, gegenbeispiel: null });
  } catch (ursache) {
    haltePropertyFest({
      id, runs, pass: false,
      gegenbeispiel: ursache instanceof Error ? ursache.message : String(ursache),
    });
    throw ursache;
  }
}
