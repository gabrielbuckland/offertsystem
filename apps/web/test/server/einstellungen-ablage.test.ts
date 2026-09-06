/**
 * Write path uses temp copy of company-defaults.json (not shipped config);
 * standardkonfiguration.test.ts guarantees the shipped one.
 */
import {
  copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { leereZwischenspeicher } from '../../src/server/konfigurations-lader.js';
import { schreibeCompanyDefaults } from '../../src/server/einstellungen-ablage.js';

const STANDARD = resolve(import.meta.dirname, '../../../../config/company-defaults.json');

let pfad: string;

beforeEach(() => {
  const verzeichnis = mkdtempSync(join(tmpdir(), 'offert-einstellungen-'));
  pfad = join(verzeichnis, 'company-defaults.json');
  copyFileSync(STANDARD, pfad);
  leereZwischenspeicher();
});

function standardRoh(): Record<string, unknown> {
  return JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, unknown>;
}

describe('schreibeCompanyDefaults', () => {
  it('weist eine Degressionsverletzung zurueck und laesst die Datei unangetastet', async () => {
    const roh = standardRoh();
    const honorar = roh['honorar'] as Record<string, unknown>;
    const stuetzstellen = honorar['stuetzstellen'] as Array<Record<string, unknown>>;
    (stuetzstellen[1] as Record<string, unknown>)['hMin'] = 999999999;
    const vorher = readFileSync(pfad, 'utf8');
    const e = await schreibeCompanyDefaults(roh, pfad);
    expect(e.ok).toBe(false);
    if (e.ok) return;
    expect(e.befunde.some((b) => b.pfad.startsWith('honorar'))).toBe(true);
    expect(readFileSync(pfad, 'utf8')).toBe(vorher);
  });

  it('schreibt eine gueltige Konfiguration atomar und sichert die Vorversion', async () => {
    const roh = standardRoh();
    const preisanpassung = roh['preisanpassung'] as Record<string, unknown>;
    preisanpassung['begruendungMinLaenge'] = 12;
    const e = await schreibeCompanyDefaults(roh, pfad);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.pruefsumme).toMatch(/^[0-9a-f]{64}$/);
    const gesichert = readdirSync(join(dirname(pfad), 'backups'));
    expect(gesichert).toHaveLength(1);
    const neu = JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, unknown>;
    const neuePreisanpassung = neu['preisanpassung'] as Record<string, unknown>;
    expect(neuePreisanpassung['begruendungMinLaenge']).toBe(12);
  });

  it('haelt die Begruendungspflicht fest: false wird zurueckgewiesen', async () => {
    const roh = standardRoh();
    const preisanpassung = roh['preisanpassung'] as Record<string, unknown>;
    preisanpassung['begruendungPflicht'] = false; // fachlich nicht abschaltbar (US-04)
    const e = await schreibeCompanyDefaults(roh, pfad);
    expect(e.ok).toBe(false);
  });

  describe('Sicherungskollision (zwei Schreibvorgaenge in derselben Millisekunde)', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('verliert bei gleichem Zeitstempel keine der beiden Vorversionen', async () => {
      // Frozen time forces collision for deterministic testing.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const ersterRoh = standardRoh();
      (ersterRoh['preisanpassung'] as Record<string, unknown>)['begruendungMinLaenge'] = 12;
      const ersteAntwort = await schreibeCompanyDefaults(ersterRoh, pfad);
      expect(ersteAntwort.ok).toBe(true);

      const zweiterRoh = standardRoh();
      (zweiterRoh['preisanpassung'] as Record<string, unknown>)['begruendungMinLaenge'] = 13;
      const zweiteAntwort = await schreibeCompanyDefaults(zweiterRoh, pfad);
      expect(zweiteAntwort.ok).toBe(true);

      const backupVerzeichnis = join(dirname(pfad), 'backups');
      const gesichert = readdirSync(backupVerzeichnis);
      expect(gesichert).toHaveLength(2);

      const inhalte = gesichert.map(
        (datei) => JSON.parse(readFileSync(join(backupVerzeichnis, datei), 'utf8')) as
          Record<string, unknown>,
      );
      const minLaengen = inhalte
        .map((i) => (i['preisanpassung'] as Record<string, unknown>)['begruendungMinLaenge'])
        .sort();
      // First backup: initial state (10); second: after first write (12), before second write (13).
      expect(minLaengen).toEqual([10, 12]);
    });

    it('bricht nach hinreichend vielen Kollisionen mit einem Befund ab, statt endlos zu '
      + 'suchen', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-02T00:00:00.000Z'));
      const backupVerzeichnis = join(dirname(pfad), 'backups');
      mkdirSync(backupVerzeichnis, { recursive: true });
      const basis = '2026-02-02T00-00-00.000Z';
      // Occupy all counter values (0..1000) up to MAX_SICHERUNGS_VERSUCHE to force exhaustion.
      writeFileSync(join(backupVerzeichnis, `${basis}.json`), '{}');
      for (let i = 1; i <= 1000; i += 1) {
        writeFileSync(join(backupVerzeichnis, `${basis}-${i}.json`), '{}');
      }
      const vorher = readFileSync(pfad, 'utf8');

      const roh = standardRoh();
      (roh['preisanpassung'] as Record<string, unknown>)['begruendungMinLaenge'] = 14;
      const antwort = await schreibeCompanyDefaults(roh, pfad);

      expect(antwort.ok).toBe(false);
      if (antwort.ok) return;
      expect(antwort.befunde[0]?.text).toContain('kein freier Name');
      // Reject, not report: failure before sichereVorversion; file unchanged.
      expect(readFileSync(pfad, 'utf8')).toBe(vorher);
    });
  });
});
