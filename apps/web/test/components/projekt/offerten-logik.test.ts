import { describe, expect, it } from 'vitest';
import { formatiereHonorarProzent, berechneHonorarProzent } from '@offert/offer';
import {
  honorarProzentZelle, referenzAus,
} from '../../../src/components/projekt/offerten-logik.js';

describe('referenzAus', () => {
  it('kuerzt die Offert-Kennung auf die ersten acht Zeichen', () => {
    expect(referenzAus('abc12345-6789-def0-1234-56789abcdef0')).toBe('abc12345');
  });
});

describe('honorarProzentZelle', () => {
  const VERKAUFSSUMME = 1_200_000_000;

  it('zeigt den gewaehlten Betrag als Prozentsatz, wenn vorhanden', () => {
    const anteil = berechneHonorarProzent(23_000_000, VERKAUFSSUMME);
    expect(honorarProzentZelle({
      honorar: 23_000_000, honorarMin: 20_000_000, honorarMax: 26_000_000,
      verkaufssumme: VERKAUFSSUMME,
    })).toBe(formatiereHonorarProzent(anteil!));
  });

  it('faellt auf die Range als Prozentspanne zurueck, wenn kein gewaehlter Betrag '
    + 'vorliegt (Altartefakt)', () => {
    const minAnteil = berechneHonorarProzent(20_000_000, VERKAUFSSUMME)!;
    const maxAnteil = berechneHonorarProzent(26_000_000, VERKAUFSSUMME)!;
    expect(honorarProzentZelle({
      honorarMin: 20_000_000, honorarMax: 26_000_000, verkaufssumme: VERKAUFSSUMME,
    })).toBe(`${formatiereHonorarProzent(minAnteil)} – ${formatiereHonorarProzent(maxAnteil)}`);
  });

  it('zeigt einen Gedankenstrich, wenn weder Betrag noch Range vorliegen', () => {
    expect(honorarProzentZelle({ verkaufssumme: VERKAUFSSUMME })).toBe('—');
  });

  it('zeigt einen Bindestrich, wenn die Verkaufssumme fehlt', () => {
    expect(honorarProzentZelle({ honorar: 23_000_000 })).toBe('–');
  });

  it('zeigt einen Bindestrich, wenn die Verkaufssumme null ist (Division durch null)', () => {
    expect(honorarProzentZelle({ honorar: 23_000_000, verkaufssumme: 0 })).toBe('–');
  });
});
