/**
 * Testdokumentation fuer Anhang E.
 *
 * Der Testartefakt-Reporter (tools/eval/report/vitest-reporter.ts) liest je
 * Test `task.meta` und schreibt die Felder nach `tests.json`; der Anhang-
 * generator druckt daraus die Testdokumentation. Fehlt ein Feld, erscheint im
 * Anhang sichtbar «METADATEN FEHLEN». Die Dokumentation steht deshalb direkt
 * im Test und nicht in einer getrennten Liste, die veralten koennte.
 *
 * `anforderung` muss eine ID aus tools/eval/report/anforderungen.json sein —
 * der Reporter wirft bei unbekannten IDs.
 */
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
