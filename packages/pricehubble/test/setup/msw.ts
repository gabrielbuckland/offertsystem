/**
 * Zentrale Testvorbereitung der Projekte `pricehubble` und `contract`.
 * Eingebunden wird sie in `vitest.workspace.ts`, nicht paketlokal (PE-12).
 *
 * Zweck: AK-07 — in `test:unit` darf kein Netzwerkzugriff stattfinden. Solange
 * es keinen Adaptercode gibt, wird die Zusage hier durch eine Sperre auf der
 * globalen `fetch`-Funktion eingeloest. P3 ersetzt diese Sperre durch einen
 * MSW-Server mit `onUnhandledRequest: 'error'`; die Zusage bleibt dieselbe,
 * nur die Durchsetzung wird genauer.
 */
import { afterAll, beforeAll } from 'vitest';

const echtesFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = ((eingabe: unknown): never => {
    throw new Error(
      `AK-07: Netzwerkzugriff im Testlauf unterbunden (${String(eingabe)}). `
      + 'Antworten kommen aus fixtures/pricehubble/, nie aus dem Netz.',
    );
  }) as unknown as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = echtesFetch;
});
