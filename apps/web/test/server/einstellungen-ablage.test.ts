/**
 * Der Schreibpfad wird gegen eine Arbeitskopie von `config/company-defaults.json`
 * in einem `mkdtemp`-Verzeichnis gefahren (nicht gegen die ausgelieferte Datei):
 * `standardkonfiguration.test.ts` garantiert deren Gueltigkeit und darf durch
 * diese Tests nicht beruehrt werden.
 */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
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
    expect(readFileSync(pfad, 'utf8')).toBe(vorher); // zurueckweisen statt melden
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
    expect(gesichert).toHaveLength(1); // zeitgestempelte Vorversion
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
});
