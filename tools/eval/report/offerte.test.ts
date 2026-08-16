import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pruefeBeispielOfferte } from './offerte.ts';

function lege(inhalt: unknown): string {
  const wurzel = mkdtempSync(join(tmpdir(), 'offerte-'));
  mkdirSync(join(wurzel, 'data', 'offerten'), { recursive: true });
  writeFileSync(
    join(wurzel, 'data', 'offerten', 'beispiel.json'), JSON.stringify(inhalt), 'utf8');
  return wurzel;
}

const erwartet = { konfigVersion: '1.0.0-vorlaeufig' };

describe('pruefeBeispielOfferte', () => {
  it('nimmt eine Offerte an, deren Konfigurationsversion dem Lauf entspricht', () => {
    const wurzel = lege({
      metadata: {
        konfigVersion: '1.0.0-vorlaeufig',
        konfigPruefsumme: 'a'.repeat(64),
        konfigurationsAbdruck: { flaeche: { alpha: 0.5 } },
      },
    });
    expect(() => pruefeBeispielOfferte(wurzel, erwartet)).not.toThrow();
  });

  it('weist eine abweichende Konfigurationsversion zurueck', () => {
    const wurzel = lege({
      metadata: {
        konfigVersion: '0.9.0',
        konfigPruefsumme: 'b'.repeat(64),
        konfigurationsAbdruck: { flaeche: { alpha: 0.5 } },
      },
    });
    expect(() => pruefeBeispielOfferte(wurzel, erwartet)).toThrow(/konfigVersion/);
  });

  it('weist eine Offerte ohne eingebettete Kopie zurueck', () => {
    const wurzel = lege({
      metadata: { konfigVersion: '1.0.0-vorlaeufig', konfigPruefsumme: 'a'.repeat(64) },
    });
    expect(() => pruefeBeispielOfferte(wurzel, erwartet)).toThrow(/konfigurationsAbdruck/);
  });

  it('meldet eine fehlende Ablage mit Herkunftsangabe', () => {
    expect(() => pruefeBeispielOfferte('/nicht/vorhanden', erwartet)).toThrow(/P4/);
  });
});
