// Quelltexttest (kein jsdom): Neuberechnung darf KEINEN eigenen Zeitgeber haben (POST liest Platte).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quelle = readFileSync(
  new URL('../../../src/components/projekt/ProjektAnsicht.tsx', import.meta.url), 'utf8');

describe('ProjektAnsicht — Berechnung ist gekettet, nicht parallel', () => {
  it('startet keinen eigenen Zeitgeber fuer die Berechnung', () => {
    expect(quelle).not.toMatch(/setTimeout/);
  });

  it('stellt die Berechnung aus dem Erfolgspfad des Speicherns ein', () => {
    // Erfolgspfad des PUT (zweiter Parameter): verketteter stelleEin-Aufruf.
    expect(quelle).toMatch(/verwendeProjekt\(\s*anfang,\s*\(gespeichert\) => \{/);
    expect(quelle).toMatch(/stelleEin\(gespeichert\);/);
  });

  it('reagiert nicht mehr auf den Projektstand als Effektabhaengigkeit', () => {
    // Alter paralleler Auslöser wäre useEffect(..., [projekt]).
    expect(quelle).not.toMatch(/\}, \[projekt\]\)/);
  });

  it('ueberspringt die Berechnung, wenn sich nur rechenirrelevante Felder aendern (I-1)', () => {
    // Weiche vor stelleEin-Aufruf im Erfolgspfad.
    expect(quelle).toMatch(/nurRechenirrelevanteFelderGeaendert\(/);
    const stelleEinIndex = quelle.indexOf('stelleEin(gespeichert);');
    const weicheIndex = quelle.indexOf('nurRechenirrelevanteFelderGeaendert(');
    expect(weicheIndex).toBeGreaterThan(-1);
    expect(weicheIndex).toBeLessThan(stelleEinIndex);
  });
});
