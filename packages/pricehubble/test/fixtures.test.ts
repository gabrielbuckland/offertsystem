import { existsSync } from 'node:fs';
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

  it('recorded/ traegt den vollstaendigen aufgezeichneten Satz (M-FIX, G-2 geschlossen)', () => {
    const verzeichnis = fileURLToPath(
      new URL('../../../fixtures/pricehubble/recorded/', import.meta.url),
    );
    const erwartet = [
      'auth/login.success.json',
      'dossier/get-dossier.success.json',
      'dossier/update-dossier.success.json',
      'dossier/valuation.success.json',
      'location/location-scores.success.json',
      'aufzeichnungsprotokoll.jsonl',
      'herkunft.json',
    ];
    for (const datei of erwartet) {
      expect(existsSync(`${verzeichnis}${datei}`), datei).toBe(true);
    }
    const herkunft = ladeFixture<{ fixtures_herkunft: string }>('recorded/herkunft.json');
    expect(herkunft.fixtures_herkunft).toBe('aufgezeichnet');
  });

  it('legt keine Fixture-Datei innerhalb des Pakets ab', () => {
    const paketWurzel = fileURLToPath(new URL('..', import.meta.url));
    expect(existsSync(`${paketWurzel}/test/fixtures/`)).toBe(false);
    expect(existsSync(`${paketWurzel}/src/__fixtures__/`)).toBe(false);
  });
});
