import { describe, expect, it } from 'vitest';
import { loeseStrategieAuf } from '../../../packages/core/src/index.ts';
import type { FaktorId, FaktorParameter } from '../../../packages/core/src/index.ts';
import {
  findeUmfangfaktor,
  klone,
  ladeBasisRoh,
  normiereMitKappung,
  validiere,
} from './konfig.ts';

describe('Konfigurationszugriff', () => {
  it('laedt die Standardkonfiguration und validiert sie fehlerfrei', () => {
    expect(validiere(ladeBasisRoh()).ok).toBe(true);
  });

  it('klont tief: eine Aenderung am Klon beruehrt das Original nicht', () => {
    const roh = ladeBasisRoh() as { flaeche: { alpha: number } };
    const kopie = klone(roh);
    kopie.flaeche.alpha = 0.9;
    expect(roh.flaeche.alpha).not.toBe(0.9);
  });

  it('weist eine Gewichtssumme ungleich 1 mit CFG_WEIGHTS_SUM zurueck', () => {
    const roh = klone(ladeBasisRoh()) as {
      aufwandfaktoren: Record<string, { gewicht: number }>;
    };
    const erster = Object.keys(roh.aufwandfaktoren).sort()[0]!;
    roh.aufwandfaktoren[erster]!.gewicht += 0.05;
    const ergebnis = validiere(roh);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_WEIGHTS_SUM');
  });

  it('findet den Umfangfaktor ueber die Quelle, nicht ueber den Bezeichner', () => {
    const k = validiere(ladeBasisRoh());
    expect(k.ok).toBe(true);
    if (!k.ok) return;
    const faktor = findeUmfangfaktor(k.wert);
    expect(faktor).not.toBeNull();
    expect(faktor?.parameter.quellSchluessel).toBe('einheitenzahl');
    expect(faktor?.parameter.gewicht).toBeGreaterThan(0);
  });
});

describe('normiereMitKappung', () => {
  it('normiert mit Kappung und traegt vertauschte Grenzen', () => {
    expect(normiereMitKappung(20, 4, 36)).toBeCloseTo(0.5, 12);
    expect(normiereMitKappung(40, 4, 36)).toBe(1);
    expect(normiereMitKappung(1, 4, 36)).toBe(0);
    expect(normiereMitKappung(0.25, 1, 0)).toBeCloseTo(0.75, 12);
  });

  it('stimmt mit der Normalisierungsstufe des Kerns ueberein', () => {
    // Die Zweitimplementierung ist nur zulaessig, solange sie dasselbe liefert wie der
    // Kern. Faellt das auseinander, bricht dieser Test — nicht erst das Kapitel 6.
    const strategie = loeseStrategieAuf('min-max');
    for (const [roh, min, max] of [[20, 4, 36], [40, 4, 36], [1, 4, 36], [0.25, 1, 0]] as const) {
      const parameter = {
        grenzeMin: min, grenzeMax: max, gewicht: 1, strategie: 'min-max',
        quelle: 'manuell', quellSchluessel: 'x', bezeichnung: 'x',
      } as unknown as FaktorParameter;
      const kern = strategie.normalisiere(roh, parameter, 'x' as FaktorId);
      expect(kern.ok).toBe(true);
      if (!kern.ok) return;
      expect(normiereMitKappung(roh, min, max)).toBeCloseTo(kern.wert.normiert, 12);
    }
  });
});
