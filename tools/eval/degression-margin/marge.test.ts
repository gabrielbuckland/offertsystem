import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoWurzel } from '../shared/artefakt.ts';
import { ladeBasis } from '../shared/konfig.ts';
import type { Stuetzstelle } from './honorarkurve.ts';
import { linkeSeite, marge, margeUeberGitter, rechteSeite, stichprobeV1 } from './marge.ts';

const stuetz: readonly Stuetzstelle[] = [
  { v: 0, hMin: 3_000_000, hMax: 4_000_000 },
  { v: 500_000_000, hMin: 11_250_000, hMax: 15_000_000 },
];
const skalierung = { form: 'linear' as const, gMin: 0.85, gMax: 1.15 };

describe('linkeSeite', () => {
  it('ist g(D2)/g(D1) und im Gleichstand genau 1', () => {
    expect(linkeSeite(skalierung, 0, 0.15)).toBeCloseTo((0.85 + 0.15 * 0.30) / 0.85, 12);
    expect(linkeSeite(skalierung, 0.5, 0.5)).toBe(1);
  });
});

describe('rechteSeite', () => {
  it('ist das Verhaeltnis der Durchschnittssaetze und groesser 1 bei Degression', () => {
    const r = rechteSeite(stuetz, 'hMax', 100_000_000, 300_000_000);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(1);
    expect(Number.isFinite(r!)).toBe(true);
  });

  it('liefert null, wenn V2 oberhalb der letzten Stuetzstelle liegt (E-04)', () => {
    expect(rechteSeite(stuetz, 'hMax', 400_000_000, 900_000_000)).toBeNull();
  });
});

describe('marge', () => {
  it('ist R/L und genau dann erfuellt, wenn M >= 1', () => {
    expect(marge(2, 1.05)).toBeCloseTo(2 / 1.05, 12);
  });
});

describe('stichprobeV1', () => {
  it('legt je Stufe fuenf Punkte und die letzte Stuetzstelle, ohne V = 0', () => {
    const punkte = stichprobeV1(stuetz);
    expect(punkte).not.toContain(0);
    expect(punkte).toContain(499_999_999);
    expect(punkte).toContain(500_000_000);
    expect([...punkte].sort((a, b) => a - b)).toEqual(punkte);
  });
});

describe('margeUeberGitter', () => {
  it('findet fuer die Standardkonfiguration eine Marge groesser 1', () => {
    const befund = margeUeberGitter(ladeBasis());
    expect(befund.margin_min).toBeGreaterThan(1);
    expect(befund.argmin).not.toBeNull();
    expect(['hMin', 'hMax']).toContain(befund.argmin!.randkurve);
    expect(befund.konstellationen_geprueft).toBeGreaterThan(0);
    expect(befund.konstellationen_verworfen).toBeGreaterThan(0);
  });

  it('wertet beide Randkurven aus (E-11)', () => {
    expect(Object.keys(margeUeberGitter(ladeBasis()).margin_min_je_randkurve).sort())
      .toEqual(['hMax', 'hMin']);
  });

  it('rechnet ohne Projektdaten: zwei Laeufe sind identisch', () => {
    expect(margeUeberGitter(ladeBasis())).toEqual(margeUeberGitter(ladeBasis()));
  });

  it('kein L des Gitters ueberschreitet die scharfe Obergrenze', () => {
    // Haelt die Herleitung fest: Der unguenstigste Fall ist ohne Suche bestimmbar, und
    // das Gitter kann ihn nicht ueberschreiten. Laeuft das rot, ist die Herleitung
    // falsch — nicht die Schranke zu lockern.
    const befund = margeUeberGitter(ladeBasis());
    expect(befund.argmin!.l).toBeLessThanOrEqual(befund.l_obergrenze_scharf + 1e-12);
    expect(befund.l_obergrenze_scharf).toBeLessThanOrEqual(befund.l_obergrenze_grob + 1e-12);
  });
});

describe('Der Rechner fuehrt keine Konfiguration aus (Spec 06 §7.2)', () => {
  it('ruft weder berechne noch fuehreAus auf', () => {
    for (const datei of ['marge.ts', 'honorarkurve.ts']) {
      const inhalt = readFileSync(
        join(repoWurzel(), 'tools', 'eval', 'degression-margin', datei), 'utf8');
      expect(inhalt, datei).not.toMatch(/\bberechne\s*\(/);
      expect(inhalt, datei).not.toMatch(/\bfuehreAus\s*\(/);
    }
  });
});
