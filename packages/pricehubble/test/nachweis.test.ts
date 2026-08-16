import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { schreibeNachweisArtefakt } from './nachweis/schreibeArtefakt.js';

describe('Nachweisartefakt (PE-18)', () => {
  it('schreibt Artefakt und latest.json-Zeiger', () => {
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

    const artefakt = JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, unknown>;
    expect(artefakt['ergebnis']).toBe('pass');
    expect(artefakt['wirkung']).toBe('detektiv');
    expect(typeof artefakt['zeitstempel']).toBe('string');

    const zeiger = JSON.parse(
      readFileSync(join(wurzel, 'contract', 'latest.json'), 'utf8'),
    ) as { readonly pfad: string };
    expect(zeiger.pfad).toContain('contract.json');
  });

  it('legt je Lauf ein eigenes Zeitstempelverzeichnis an', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'artefakt-'));
    const a = schreibeNachweisArtefakt(wurzel, 'integration', {
      systemverhalten: 'a',
      fehlerstatus: 'keiner',
      pipelineZustand: 'abgeschlossen',
      ergebnis: 'pass',
      anzahlTests: 1,
      laufzeitMs: 1,
    });
    expect(a).toMatch(/integration[/\\][^/\\]+[/\\]integration\.json$/);
  });
});
