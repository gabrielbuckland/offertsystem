import { describe, expect, it } from 'vitest';
import { berechne } from '../../../packages/core/src/index.ts';
import { ladeBasis } from '../shared/konfig.ts';
import { baueEingang } from '../shared/lauf.ts';
import { ladeSzenarien } from '../shared/szenario.ts';
import {
  durchschnittssatz,
  gVon,
  honorarbasis,
  stufeVon,
  type Stuetzstelle,
} from './honorarkurve.ts';

const stuetz: readonly Stuetzstelle[] = [
  { v: 0, hMin: 3_000_000, hMax: 4_000_000 },
  { v: 500_000_000, hMin: 11_250_000, hMax: 15_000_000 },
  { v: 1_000_000_000, hMin: 19_500_000, hMax: 26_000_000 },
];

describe('stufeVon', () => {
  it('waehlt die Stufe halboffen nach unten', () => {
    expect(stufeVon(stuetz, 0)).toBe(0);
    expect(stufeVon(stuetz, 499_999_999)).toBe(0);
    expect(stufeVon(stuetz, 500_000_000)).toBe(1);
  });

  it('liefert null oberhalb der letzten Stuetzstelle (E-04, keine Extrapolation)', () => {
    expect(stufeVon(stuetz, 1_000_000_001)).toBeNull();
  });

  it('liefert fuer die letzte Stuetzstelle selbst die letzte Stufe', () => {
    expect(stufeVon(stuetz, 1_000_000_000)).toBe(1);
  });
});

describe('honorarbasis', () => {
  it('interpoliert linear zwischen zwei Stuetzstellen', () => {
    expect(honorarbasis(stuetz, 'hMax', 250_000_000)).toBeCloseTo(9_500_000, 6);
  });

  it('trifft die Stuetzstellen exakt', () => {
    expect(honorarbasis(stuetz, 'hMin', 500_000_000)).toBe(11_250_000);
    expect(honorarbasis(stuetz, 'hMin', 1_000_000_000)).toBe(19_500_000);
  });

  it('liefert null oberhalb der letzten Stuetzstelle', () => {
    expect(honorarbasis(stuetz, 'hMax', 1_500_000_000)).toBeNull();
  });
});

describe('durchschnittssatz', () => {
  it('ist H(V)/V und fuer V = 0 nicht definiert', () => {
    expect(durchschnittssatz(stuetz, 'hMax', 1_000_000_000)).toBeCloseTo(0.026, 12);
    expect(durchschnittssatz(stuetz, 'hMax', 0)).toBeNull();
  });
});

describe('Gegenprobe gegen die Standardkonfiguration und den Kern', () => {
  const konfig = ladeBasis();
  const echte = konfig.honorar.stuetzstellen as readonly Stuetzstelle[];

  it('stimmt mit Stufe 5 des Kerns ueberein (ungerundete Basis)', () => {
    // Laeuft das auseinander, ist NICHT die Werkzeugfassung anzupassen: Zwei
    // Implementierungen derselben Formel, die abweichen, sind ein Modell- oder
    // Implementierungsfehler.
    let geprueft = 0;
    for (const s of ladeSzenarien()) {
      const eingang = baueEingang(s, konfig);
      if (!eingang.ok) continue;
      const ergebnis = berechne(eingang.argumente);
      if (!ergebnis.ok) continue;
      const h = ergebnis.wert.honorar;
      expect(honorarbasis(echte, 'hMin', h.verkaufssumme)).toBeCloseTo(h.basisMin, 6);
      expect(honorarbasis(echte, 'hMax', h.verkaufssumme)).toBeCloseTo(h.basisMax, 6);
      geprueft += 1;
    }
    expect(geprueft).toBeGreaterThan(0);
  });
});

describe('gVon', () => {
  it('bildet g linear auf [gMin, gMax] ab und ist monoton steigend (I-15)', () => {
    const s = { form: 'linear' as const, gMin: 0.85, gMax: 1.15 };
    expect(gVon(s, 0)).toBeCloseTo(0.85, 12);
    expect(gVon(s, 0.5)).toBeCloseTo(1.0, 12);
    expect(gVon(s, 1)).toBeCloseTo(1.15, 12);
    expect(gVon(s, 0.3)).toBeLessThan(gVon(s, 0.7));
  });
});
