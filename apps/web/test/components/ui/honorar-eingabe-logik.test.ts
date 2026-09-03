import { describe, expect, it } from 'vitest';
import { formatiereHonorarProzent, honorarAbweichung } from '@offert/offer';
import {
  formatiereHonorarAlsProzent, honorarSperrgrund, prozentEingabeZuRappen,
} from '../../../src/components/ui/honorar-eingabe-logik.js';

const VERKAUFSSUMME = 210_085_406;

describe('prozentEingabeZuRappen', () => {
  it('leitet aus dem Prozentsatz den Rappenbetrag an der Verkaufssumme ab', () => {
    expect(prozentEingabeZuRappen('3.2', VERKAUFSSUMME)).toBe(6_722_733);
  });

  it('rundet an der Rappengrenze symmetrisch vom Nullpunkt weg (rundeAufRappen, E-10) '
    + '— `Math.round` lieferte fuer -0.5 Rappen eine Null', () => {
    expect(prozentEingabeZuRappen('0.05', 1000)).toBe(1);
    expect(prozentEingabeZuRappen('-0.05', 1000)).toBe(-1);
  });

  it('liefert undefined bei leerer Eingabe', () => {
    expect(prozentEingabeZuRappen('', VERKAUFSSUMME)).toBeUndefined();
    expect(prozentEingabeZuRappen('   ', VERKAUFSSUMME)).toBeUndefined();
  });

  it('liefert undefined bei nicht parsierbarer Eingabe', () => {
    expect(prozentEingabeZuRappen('abc', VERKAUFSSUMME)).toBeUndefined();
  });

  it('liefert undefined ohne brauchbare Verkaufssumme — ohne Bezugsgroesse gibt es '
    + 'keinen Betrag', () => {
    expect(prozentEingabeZuRappen('3.2', undefined)).toBeUndefined();
    expect(prozentEingabeZuRappen('3.2', 0)).toBeUndefined();
  });

  it('meldet einen Prozentsatz ausserhalb der Range als Abweichung, verhindert ihn aber '
    + 'nicht — die Range ist eine Empfehlung, keine Schranke', () => {
    const betrag = prozentEingabeZuRappen('5', VERKAUFSSUMME);
    expect(betrag).toBe(10_504_270);
    expect(honorarAbweichung(betrag!, { min: 6_000_000, max: 7_000_000 })).toBe('ueber-range');
    expect(honorarSperrgrund('5', betrag, VERKAUFSSUMME)).toBeUndefined();
  });
});

describe('formatiereHonorarAlsProzent', () => {
  it('formatiert den Anteil an der Verkaufssumme mit einer Nachkommastelle', () => {
    expect(formatiereHonorarAlsProzent(6_722_733, VERKAUFSSUMME))
      .toBe(formatiereHonorarProzent(6_722_733 / VERKAUFSSUMME));
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
    expect(honorarSperrgrund('3.2', 6_722_733, VERKAUFSSUMME)).toBeUndefined();
  });

  it('nennt die leere Eingabe als Sperrgrund, solange das Feld unberuehrt ist '
    + '(Nachtrag Spec 2026-08-29: kein Vorschlagswert mehr)', () => {
    expect(honorarSperrgrund('', undefined, VERKAUFSSUMME)).toBe(
      'Bitte einen Honorarsatz in Prozent eingeben, um die Offerte zu erzeugen.');
  });

  it('behandelt eine Eingabe aus nur Leerzeichen wie eine leere Eingabe', () => {
    expect(honorarSperrgrund('   ', undefined, VERKAUFSSUMME)).toBe(
      'Bitte einen Honorarsatz in Prozent eingeben, um die Offerte zu erzeugen.');
  });

  it('nennt eine andere Meldung fuer eine nicht parsierbare Eingabe als fuer eine '
    + 'leere — der Vermarkter sieht den Unterschied', () => {
    expect(honorarSperrgrund('abc', undefined, VERKAUFSSUMME))
      .toBe('Der eingegebene Prozentsatz ist ungültig.');
  });

  it('sperrt ohne brauchbare Verkaufssumme mit eigener Begruendung, auch bei gueltiger '
    + 'Eingabe — der Prozentsatz ist dann nicht umrechenbar', () => {
    const meldung = 'Ohne Verkaufssumme lässt sich der Prozentsatz nicht in einen '
      + 'Betrag umrechnen.';
    expect(honorarSperrgrund('3.2', undefined, undefined)).toBe(meldung);
    expect(honorarSperrgrund('3.2', undefined, 0)).toBe(meldung);
  });
});
