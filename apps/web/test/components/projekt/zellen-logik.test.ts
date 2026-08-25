import { describe, expect, it } from 'vitest';
import {
  entscheideZellenwert, faktorZuProzent, frankenZuRappen, prozentZuFaktor, rappenZuFranken,
} from '../../../src/components/projekt/zellen-logik.js';

describe('entscheideZellenwert', () => {
  it('uebernimmt eine gueltige Zahl', () => {
    expect(entscheideZellenwert('5')).toEqual({ art: 'uebernehmen', wert: 5 });
    expect(entscheideZellenwert('-3.5')).toEqual({ art: 'uebernehmen', wert: -3.5 });
  });

  it('verwirft ein geleertes Feld, statt eine 0 zu erfinden', () => {
    expect(entscheideZellenwert('')).toEqual({ art: 'verwerfen' });
    expect(entscheideZellenwert('   ')).toEqual({ art: 'verwerfen' });
  });

  it('verwirft einen nicht parsierbaren Entwurf', () => {
    expect(entscheideZellenwert('-')).toEqual({ art: 'verwerfen' });
    expect(entscheideZellenwert('1,5')).toEqual({ art: 'verwerfen' });
    expect(entscheideZellenwert('abc')).toEqual({ art: 'verwerfen' });
  });
});

describe('faktorZuProzent / prozentZuFaktor', () => {
  it('rechnet verlustfrei hin und zurueck, auch bei Gleitkomma-Faellen', () => {
    for (const faktor of [0.05, 0.15, 0.07, -0.02, 0, 1, 0.333]) {
      expect(prozentZuFaktor(faktorZuProzent(faktor))).toBeCloseTo(faktor, 9);
    }
  });

  it('zeigt einen gespeicherten Faktor als die erwartete Prozentzahl', () => {
    expect(faktorZuProzent(0.05)).toBe(5);
    expect(faktorZuProzent(0.07)).toBe(7);
  });

  it('rechnet eine eingegebene Prozentzahl auf den erwarteten Faktor', () => {
    expect(prozentZuFaktor(5)).toBe(0.05);
  });
});

describe('frankenZuRappen / rappenZuFranken', () => {
  it('rechnet einen gespeicherten Rappenbetrag verlustfrei in Franken hin und zurueck', () => {
    expect(rappenZuFranken(1_000_000)).toBe(10_000);
    expect(frankenZuRappen(rappenZuFranken(1_000_000))).toBe(1_000_000);
  });

  it('rundet einen gebrochenen Frankenbetrag auf ganze Rappen, statt zu kuerzen', () => {
    expect(frankenZuRappen(10.5)).toBe(1050);
    expect(Number.isInteger(frankenZuRappen(10.5))).toBe(true);
  });

  it('produziert einen Rappenbetrag, der hundertmal groesser ist als der eingegebene '
    + 'Frankenbetrag — nicht gleich gross (der urspruengliche Fehler: CHF 10000 wurden '
    + 'als 10000 Rappen statt als 1000000 Rappen abgelegt)', () => {
    const eingegebeneFranken = 10_000;
    expect(frankenZuRappen(eingegebeneFranken)).toBe(eingegebeneFranken * 100);
    expect(frankenZuRappen(eingegebeneFranken)).not.toBe(eingegebeneFranken);
  });
});
