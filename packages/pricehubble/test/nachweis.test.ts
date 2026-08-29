import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { schreibeNachweisArtefakt } from './nachweis/schreibeArtefakt.js';

describe('Nachweisartefakt (PE-18)', () => {
  it('schreibt Artefakt und latest.json-Zeiger in ein eigenes Zeitstempelverzeichnis je Lauf', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'artefakt-'));
    const pfad = schreibeNachweisArtefakt(wurzel, 'contract', {
      systemverhalten: 'Contract-Schemata gegen Fixtures',
      fehlerstatus: 'keiner',
      pipelineZustand: 'nicht gestartet',
      ergebnis: 'pass',
      anzahlTests: 13,
      laufzeitMs: 412,
      wirkung: 'detektiv',
      fixtures_herkunft: 'synthetisch',
    });
    expect(pfad).toMatch(/contract[/\\][^/\\]+[/\\]contract\.json$/);

    const artefakt = JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, unknown>;
    expect(artefakt['ergebnis']).toBe('pass');
    expect(artefakt['wirkung']).toBe('detektiv');
    expect(typeof artefakt['zeitstempel']).toBe('string');

    const zeiger = JSON.parse(
      readFileSync(join(wurzel, 'contract', 'latest.json'), 'utf8'),
    ) as { readonly pfad: string };
    expect(zeiger.pfad).toContain('contract.json');
  });
});
