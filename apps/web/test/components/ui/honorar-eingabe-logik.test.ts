import { describe, expect, it } from 'vitest';
import { formatiereHonorarProzent } from '@offert/offer';
import {
  formatiereHonorarAlsProzent, frankenEingabeZuRappen, honorarSperrgrund,
} from '../../../src/components/ui/honorar-eingabe-logik.js';

describe('frankenEingabeZuRappen', () => {
  it('rundet auf den naechsten Rappen', () => {
    expect(frankenEingabeZuRappen('10.005')).toBe(1001);
  });

  it('liefert undefined bei leerer Eingabe', () => {
    expect(frankenEingabeZuRappen('')).toBeUndefined();
    expect(frankenEingabeZuRappen('   ')).toBeUndefined();
  });

  it('liefert undefined bei nicht parsierbarer Eingabe', () => {
    expect(frankenEingabeZuRappen('abc')).toBeUndefined();
  });
});

describe('formatiereHonorarAlsProzent', () => {
  it('formatiert den Anteil an der Verkaufssumme mit einer Nachkommastelle', () => {
    expect(formatiereHonorarAlsProzent(6_722_733, 210_085_406))
      .toBe(formatiereHonorarProzent(6_722_733 / 210_085_406));
  });

  it('liefert einen Bindestrich statt NaN/Infinity, wenn die Verkaufssumme fehlt', () => {
    expect(formatiereHonorarAlsProzent(6_722_733, undefined)).toBe('–');
  });

  it('liefert einen Bindestrich, wenn die Verkaufssumme null ist', () => {
    expect(formatiereHonorarAlsProzent(6_722_733, 0)).toBe('–');
  });
});

describe('honorarSperrgrund', () => {
  it('gibt keinen Sperrgrund, wenn ein gueltiger Betrag vorliegt', () => {
    expect(honorarSperrgrund('6722733', 6_722_733)).toBeUndefined();
  });

  it('nennt die leere Eingabe als Sperrgrund, solange das Feld unberuehrt ist '
    + '(Nachtrag Spec 2026-08-29: kein Vorschlagswert mehr)', () => {
    expect(honorarSperrgrund('', undefined)).toBe(
      'Bitte einen Honorarbetrag eingeben, um die Offerte zu erzeugen.');
  });

  it('behandelt eine Eingabe aus nur Leerzeichen wie eine leere Eingabe', () => {
    expect(honorarSperrgrund('   ', undefined)).toBe(
      'Bitte einen Honorarbetrag eingeben, um die Offerte zu erzeugen.');
  });

  it('nennt eine andere Meldung fuer eine nicht parsierbare Eingabe als fuer eine '
    + 'leere — der Vermarkter sieht den Unterschied', () => {
    expect(honorarSperrgrund('abc', undefined)).toBe('Der eingegebene Betrag ist ungültig.');
  });
});
