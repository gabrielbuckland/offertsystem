// Testdokumentation fuer Anhang E: Der Reporter (tools/eval/report/vitest-reporter.ts)
// liest je Test `task.meta` und schreibt sie nach `tests.json`. Fehlt ein Feld, erscheint
// im Anhang sichtbar «METADATEN FEHLEN» — deshalb steht die Dokumentation direkt im Test.
// `anforderung` muss eine ID aus tools/eval/report/anforderungen.json sein, sonst wirft der Reporter.
import type { Task } from 'vitest';

declare module 'vitest' {
  interface TaskMeta {
    vorbedingung?: string;
    schritte?: string;
    erwartung?: string;
    invariante?: string;
    anforderung?: string;
  }
}

export interface TestDoku {
  readonly vorbedingung: string;
  readonly schritte: string;
  readonly erwartung: string;
  readonly invariante?: string;
  readonly anforderung?: string;
}

export function dokumentiere(task: Task, doku: TestDoku): void {
  Object.assign(task.meta, doku);
}
