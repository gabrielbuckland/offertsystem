import { describe, expect, it } from 'vitest';
import {
  berechneHonorarProzent, honorarAbweichung, validiereGewaehltesHonorar,
} from '../../src/model/honorar-eingabe.js';

describe('validiereGewaehltesHonorar', () => {
  it('akzeptiert einen ganzzahligen Rappenbetrag', () => {
    expect(validiereGewaehltesHonorar(6_722_733)).toEqual({ ok: true, wert: 6_722_733 });
  });

  it('akzeptiert einen Betrag ausserhalb jeder Range — die Range ist Empfehlung, keine '
    + 'Schranke', () => {
    expect(validiereGewaehltesHonorar(1)).toEqual({ ok: true, wert: 1 });
  });

  it('weist einen nicht ganzzahligen Betrag zurueck', () => {
    const p = validiereGewaehltesHonorar(6_722_733.5);
    expect(p.ok).toBe(false);
    expect(!p.ok && p.text).toContain('ganzzahlig');
  });

  it('weist eine fehlende Angabe zurueck', () => {
    expect(validiereGewaehltesHonorar(undefined).ok).toBe(false);
  });

  it('weist eine Zeichenkette zurueck', () => {
    expect(validiereGewaehltesHonorar('6722733').ok).toBe(false);
  });

  it('weist NaN und Infinity zurueck', () => {
    expect(validiereGewaehltesHonorar(Number.NaN).ok).toBe(false);
    expect(validiereGewaehltesHonorar(Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it('weist einen negativen Betrag zurueck (Review-Befund 2026-08-29)', () => {
    const p = validiereGewaehltesHonorar(-50_000_00);
    expect(p.ok).toBe(false);
    expect(!p.ok && p.text).toContain('positiv');
  });

  it('weist einen Betrag von null zurueck', () => {
    const p = validiereGewaehltesHonorar(0);
    expect(p.ok).toBe(false);
    expect(!p.ok && p.text).toContain('positiv');
  });
});

describe('berechneHonorarProzent', () => {
  it('berechnet den Anteil des Honorars an der Verkaufssumme', () => {
    expect(berechneHonorarProzent(6_722_733, 210_085_406)).toBeCloseTo(0.032, 5);
  });

  it('liefert null statt NaN/Infinity bei einer Verkaufssumme von null', () => {
    expect(berechneHonorarProzent(6_722_733, 0)).toBeNull();
  });

  it('liefert null bei einer negativen Verkaufssumme', () => {
    expect(berechneHonorarProzent(6_722_733, -1)).toBeNull();
  });
});

describe('honorarAbweichung', () => {
  const RANGE = { min: 5_378_186, max: 8_067_279 };

  it('meldet einen Betrag innerhalb der Range', () => {
    expect(honorarAbweichung(6_722_733, RANGE)).toBe('im-bereich');
  });

  it('meldet einen Betrag an den Grenzen als im Bereich (inklusive)', () => {
    expect(honorarAbweichung(RANGE.min, RANGE)).toBe('im-bereich');
    expect(honorarAbweichung(RANGE.max, RANGE)).toBe('im-bereich');
  });

  it('meldet einen Betrag unterhalb der Range', () => {
    expect(honorarAbweichung(RANGE.min - 1, RANGE)).toBe('unter-range');
  });

  it('meldet einen Betrag oberhalb der Range', () => {
    expect(honorarAbweichung(RANGE.max + 1, RANGE)).toBe('ueber-range');
  });
});
