import { describe, expect, it } from 'vitest';
import {
  entscheideZellenwert, faktorZuProzent, istBegruendungGueltig, prozentZuFaktor,
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

describe('istBegruendungGueltig', () => {
  it('lehnt eine zu kurze Begruendung ab', () => {
    expect(istBegruendungGueltig('ok', 10)).toBe(false);
  });

  it('lehnt eine Begruendung ab, die nur nach Trim zu kurz ist', () => {
    expect(istBegruendungGueltig('   ok   ', 10)).toBe(false);
  });

  it('akzeptiert eine ausreichend lange Begruendung', () => {
    expect(istBegruendungGueltig('Balkonlage Sued', 10)).toBe(true);
  });
});
