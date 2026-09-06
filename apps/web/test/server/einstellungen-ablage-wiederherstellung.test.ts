/**
 * Covers branch: ladeKonfiguration fails after successful write (gap between core and load).
 * Mocks ladeKonfiguration to surface the dead path; actual logic tested unmocked elsewhere.
 */
import { dirname, join, resolve } from 'node:path';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

// vi.mock hoisted before imports regardless of position; subsequent imports bind to mock.
vi.mock('../../src/server/konfigurations-lader.js', () => ({
  ladeKonfiguration: vi.fn(() => ({
    ok: false,
    fehler: [{
      code: 'CFG_SCHEMA_TYPE', ebene: 1, pfad: '(datei)', parameter: {},
    }],
  })),
  leereZwischenspeicher: vi.fn(),
}));

import { schreibeCompanyDefaults } from '../../src/server/einstellungen-ablage.js';

const STANDARD = resolve(import.meta.dirname, '../../../../config/company-defaults.json');

let pfad: string;
let vorher: string;

beforeEach(() => {
  const verzeichnis = mkdtempSync(join(tmpdir(), 'offert-einstellungen-restore-'));
  pfad = join(verzeichnis, 'company-defaults.json');
  copyFileSync(STANDARD, pfad);
  vorher = readFileSync(pfad, 'utf8');
});

describe('schreibeCompanyDefaults — Wiederherstellung nach fehlgeschlagenem Nachladen', () => {
  it('kopiert die Sicherung atomar zurueck und meldet einen Befund, wenn '
    + 'ladeKonfiguration nach dem Schreiben scheitert', async () => {
    const roh = JSON.parse(vorher) as Record<string, unknown>;
    (roh['preisanpassung'] as Record<string, unknown>)['begruendungMinLaenge'] = 12;

    const ergebnis = await schreibeCompanyDefaults(roh, pfad);

    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.befunde).toHaveLength(1);
    expect(ergebnis.befunde[0]?.text).toContain('wiederhergestellt');
    // Backup restored despite mock failure in reload step.
    expect(readFileSync(pfad, 'utf8')).toBe(vorher);
    // Write succeeded (backup exists); failure is post-write in reload.
    const gesichert = readdirSync(join(dirname(pfad), 'backups'));
    expect(gesichert).toHaveLength(1);
  });
});
