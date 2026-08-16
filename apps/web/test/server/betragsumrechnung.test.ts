import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rechneBetragInFaktor } from '../../src/server/betragsumrechnung.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');

describe('Absoluter Betrag -> Faktor (PE-21, Spec 03 §1.4)', () => {
  it('bildet den Faktor aus Betrag und Basispreis der Einheit', () => {
    // Basispreis b_j = 850'000.00 CHF = 85_000_000 Rappen
    const ergebnis = rechneBetragInFaktor(4_250_000, 85_000_000);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert).toBeCloseTo(0.05, 12);
  });

  it('bildet einen Abschlag als negativen Faktor ab', () => {
    const ergebnis = rechneBetragInFaktor(-2_550_000, 85_000_000);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert).toBeCloseTo(-0.03, 12);
  });

  it('lehnt einen Abschlag ab, der den Basispreis erreicht (I-06)', () => {
    const ergebnis = rechneBetragInFaktor(-85_000_000, 85_000_000);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldung).toContain('Basispreis');
  });

  it('lehnt die Umrechnung ohne Basispreis ab, statt null anzunehmen', () => {
    expect(rechneBetragInFaktor(1_000, 0).ok).toBe(false);
  });
});

describe('Die Basispreise stammen aus Stufe 2, nicht aus einer zweiten Formel (I-23)', () => {
  it('bildet weder Referenzflaeche noch Quadratmeterpreis selbst', () => {
    const quelle = readFileSync(`${WURZEL}/apps/web/src/server/betragsumrechnung.ts`, 'utf8');
    // Die Bezeichner duerfen im Kommentar vorkommen; gesucht wird im Code.
    const code = quelle
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const verboten of ['referenzflaeche', 'alpha', 'Math.pow', '**']) {
      expect(code, `betragsumrechnung.ts nennt ${verboten}`).not.toContain(verboten);
    }
    // Stattdessen ruft sie die Kernstufen auf.
    expect(code).toContain('berechneVerkaufssumme');
    expect(code).toContain('bereiteEingabeAuf');
  });
});
