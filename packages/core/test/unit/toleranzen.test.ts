import { describe, expect, it } from 'vitest';
import { alleToleranzen, rangeBreiteToleranz, toleranzFuer } from '../../src/config/toleranzen.js';

describe('Toleranzen sind dokumentiert, nicht versteckt (Brief §5.3, E-17)', () => {
  it('fuehrt genau die Werte aus Spec 03 §5.6', () => {
    expect(toleranzFuer('I-05')).toMatchObject({ kette: 'preis', typ: 'exakt', wert: 0 });
    expect(toleranzFuer('I-08')).toMatchObject({ kette: 'preis', typ: 'exakt', wert: 0 });
    expect(toleranzFuer('I-10')).toMatchObject({ typ: 'exakt', wert: 0 });
    expect(toleranzFuer('I-11')).toMatchObject({ typ: 'exakt', wert: 0 });
    expect(toleranzFuer('I-12')).toMatchObject({ typ: 'absolut', wert: 1e-9 });
    expect(toleranzFuer('I-14')).toMatchObject({ typ: 'exakt', wert: 0 });
    expect(toleranzFuer('I-15')).toMatchObject({ typ: 'absolut', wert: 1e-12 });
    expect(toleranzFuer('I-17')).toMatchObject({ typ: 'rappen_je_randwert', wert: 1 });
    expect(toleranzFuer('I-18')).toMatchObject({ typ: 'absolut', wert: 1e-12 });
    expect(toleranzFuer('I-22')).toMatchObject({ typ: 'absolut', wert: 1e-12 });
  });

  it('traegt je Invariante eine Begruendung — sonst waere die Toleranz gegriffen', () => {
    for (const t of alleToleranzen()) {
      expect(t.begruendung.length).toBeGreaterThan(20);
      expect(t.kurztext.length).toBeGreaterThan(5);
    }
  });

  it('leitet die I-17-Schranke aus der Rundung R3 ab, statt sie zu greifen', () => {
    // Ein Rappen je Randwert: |dw| <= (1 + (1 + w)) / hMin
    expect(rangeBreiteToleranz(1_000_000, 0.3333)).toBeCloseTo(2.3333e-6, 12);
  });

  it('wirft bei unbekannter Invariantenkennung statt still null zu liefern', () => {
    // @ts-expect-error absichtlich unbekannte Kennung
    expect(() => toleranzFuer('I-99')).toThrow(/I-99/);
  });
});
