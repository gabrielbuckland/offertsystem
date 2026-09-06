/**
 * Deckt den Zweig ab, der einspringt, wenn `ladeKonfiguration` NACH einem erfolgreichen
 * Schreibvorgang scheitert (Luecke zwischen Kernvalidierung und Ladepfad). Unter legitimer,
 * JSON-rundreisefaehiger Eingabe ist diese Divergenz mit den heutigen Fixtures nicht
 * erreichbar, da `ladeKonfiguration` intern erneut dieselbe Validierung durchlaeuft, die das
 * Schreiben bereits bestanden hat. Diese Datei mockt deshalb gezielt `ladeKonfiguration`, um
 * den sonst toten Zweig nachweisbar zu machen; die eigentliche Schreib-/Validierungslogik
 * laeuft in einer anderen Suite ungemockt gegen den echten Lader.
 */
import { dirname, join, resolve } from 'node:path';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

// `vi.mock` wird von Vitest an den Dateianfang gehoben (vor alle Imports), unabhaengig von
// der Schreibposition — der nachfolgende statische Import von `schreibeCompanyDefaults`
// bindet deshalb bereits gegen diese gemockte Fassung des Laders.
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

    // Die Datei traegt wieder den Vorher-Stand — die Sicherung wurde zurueckkopiert,
    // obwohl das (gemockte) Nachladen fehlschlug.
    expect(readFileSync(pfad, 'utf8')).toBe(vorher);

    // Der Schreibversuch selbst lief durch (Backup existiert) — der Fehlschlag liegt
    // erst NACH dem Schreiben, im Nachladeschritt.
    const gesichert = readdirSync(join(dirname(pfad), 'backups'));
    expect(gesichert).toHaveLength(1);
  });
});
