import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ladeFixture } from './fixtures.js';

describe('Fixture-Ablage (E-14, AK-21)', () => {
  it('laedt ein synthetisches Fixture', () => {
    const antwort = ladeFixture<{ valuationSale: { value: number } }>(
      'synthetic/dossier/valuation.success.json',
    );
    expect(antwort.valuationSale.value).toBe(971000);
  });

  it('haelt recorded/ leer, solange M-FIX offen ist (G-2)', () => {
    const verzeichnis = fileURLToPath(
      new URL('../../../fixtures/pricehubble/recorded/', import.meta.url),
    );
    const dateien = readdirSync(verzeichnis).filter((n) => n.endsWith('.json'));
    expect(dateien).toEqual([]);
  });

  it('legt keine Fixture-Datei innerhalb des Pakets ab', () => {
    const paketWurzel = fileURLToPath(new URL('..', import.meta.url));
    expect(existsSync(`${paketWurzel}/test/fixtures/`)).toBe(false);
    expect(existsSync(`${paketWurzel}/src/__fixtures__/`)).toBe(false);
  });
});
