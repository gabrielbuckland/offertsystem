import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Fixtures liegen ausserhalb der Pakete (E-14, E-15). */
const FIXTURE_WURZEL = fileURLToPath(
  new URL('../../../fixtures/pricehubble/', import.meta.url),
);

export const TEST_DOSSIER_ID = '00000000-0000-4000-8000-000000000001';

export function ladeFixture<T>(relativerPfad: string): T {
  return JSON.parse(readFileSync(`${FIXTURE_WURZEL}${relativerPfad}`, 'utf8')) as T;
}
