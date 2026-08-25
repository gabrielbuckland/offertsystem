/**
 * Reine Funktionen des Aufwandfaktoren-Editors (Task 16) — ohne React testbar.
 */
import { describe, expect, it } from 'vitest';
import { neuerManuellerFaktor, renormalisiereGewichte } from '../../../src/components/einstellungen/faktoren-logik.js';

describe('renormalisiereGewichte', () => {
  it('skaliert proportional auf Summe 1', () => {
    const ergebnis = renormalisiereGewichte({
      a: { gewicht: 0.5 },
      b: { gewicht: 0.3 },
    });
    expect(ergebnis['a']!.gewicht).toBeCloseTo(0.625, 10);
    expect(ergebnis['b']!.gewicht).toBeCloseTo(0.375, 10);
  });

  it('ergibt exakt Summe 1 auch bei Dritteln (Restdifferenz auf den groessten Eintrag)', () => {
    const ergebnis = renormalisiereGewichte({
      a: { gewicht: 1 },
      b: { gewicht: 1 },
      c: { gewicht: 1 },
    });
    const summe = ergebnis['a']!.gewicht + ergebnis['b']!.gewicht + ergebnis['c']!.gewicht;
    expect(summe).toBe(1);
  });

  it('laesst einen Eintrag mit Gewicht 0 bei 0', () => {
    const ergebnis = renormalisiereGewichte({
      a: { gewicht: 1 },
      b: { gewicht: 0 },
    });
    expect(ergebnis['b']!.gewicht).toBe(0);
    expect(ergebnis['a']!.gewicht).toBe(1);
  });
});

describe('neuerManuellerFaktor', () => {
  it('liefert ein minmax-Roh­geruest mit Gewicht 0 fuer den gegebenen Schluessel', () => {
    const faktor = neuerManuellerFaktor('aussenraum');
    expect(faktor.quellSchluessel).toBe('aussenraum');
    expect(faktor.gewicht).toBe(0);
    expect(faktor.quelle).toBe('manuell');
    expect(faktor.strategie).toBe('minmax');
    expect(faktor.min).toBe(1);
    expect(faktor.max).toBe(6);
  });
});
