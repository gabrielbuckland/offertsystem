import { describe, expect, it } from 'vitest';
import {
  naechsteEintraegeNachEntfernen,
  naechsteEintraegeNachHinzufuegen,
  naechsteEintraegeNachWertaenderung,
} from '../../../src/components/ui/schluessel-wert-logik.js';

describe('naechsteEintraegeNachHinzufuegen (Leerschluessel-Sperre)', () => {
  it('haengt einen neuen Schluessel mit seinem Wert an', () => {
    expect(naechsteEintraegeNachHinzufuegen({ a: '1' }, 'b', '2')).toEqual({ a: '1', b: '2' });
  });

  it('ueberschreibt einen bereits vorhandenen Schluessel (Upsert)', () => {
    expect(naechsteEintraegeNachHinzufuegen({ a: '1' }, 'a', '9')).toEqual({ a: '9' });
  });

  it('weist einen leeren Schluessel ab (keine Aenderung)', () => {
    expect(naechsteEintraegeNachHinzufuegen({ a: '1' }, '', 'x')).toBeUndefined();
  });

  it('trimmt den Schluessel und weist einen nur aus Leerzeichen bestehenden ab', () => {
    expect(naechsteEintraegeNachHinzufuegen({}, '   ', 'x')).toBeUndefined();
    expect(naechsteEintraegeNachHinzufuegen({}, '  b  ', '2')).toEqual({ b: '2' });
  });
});

describe('naechsteEintraegeNachEntfernen', () => {
  it('entfernt genau den benannten Schluessel und laesst die uebrigen stehen', () => {
    expect(naechsteEintraegeNachEntfernen({ a: '1', b: '2', c: '3' }, 'b'))
      .toEqual({ a: '1', c: '3' });
  });

  it('trimmt den Schluessel NICHT — er stammt aus dem Bestand, nicht aus einer Eingabe', () => {
    expect(naechsteEintraegeNachEntfernen({ ' a ': '1', a: '2' }, ' a '))
      .toEqual({ a: '2' });
  });

  it('laesst einen unbekannten Schluessel den Stand unveraendert', () => {
    expect(naechsteEintraegeNachEntfernen({ a: '1' }, 'weg')).toEqual({ a: '1' });
  });

  it('gibt eine Kopie zurueck, statt den uebergebenen Stand zu veraendern', () => {
    const vorher = { a: '1', b: '2' };
    const nachher = naechsteEintraegeNachEntfernen(vorher, 'a');
    expect(vorher).toEqual({ a: '1', b: '2' });
    expect(nachher).not.toBe(vorher);
  });
});

describe('naechsteEintraegeNachWertaenderung', () => {
  it('ersetzt den Wert eines bestehenden Schluessels', () => {
    expect(naechsteEintraegeNachWertaenderung({ a: '1', b: '2' }, 'a', '9'))
      .toEqual({ a: '9', b: '2' });
  });

  it('uebernimmt einen leeren Wert — zulaessiger Zwischenstand beim Tippen', () => {
    expect(naechsteEintraegeNachWertaenderung({ a: '1' }, 'a', '')).toEqual({ a: '' });
  });

  it('trimmt den Wert nicht, damit ein Leerzeichen eintippbar bleibt', () => {
    expect(naechsteEintraegeNachWertaenderung({ a: '1' }, 'a', 'sehr  gut '))
      .toEqual({ a: 'sehr  gut ' });
  });

  it('legt einen unbekannten Schluessel an (dieselbe Upsert-Semantik wie beim Hinzufuegen)',
    () => {
      expect(naechsteEintraegeNachWertaenderung({ a: '1' }, 'b', '2'))
        .toEqual({ a: '1', b: '2' });
    });

  it('gibt eine Kopie zurueck, statt den uebergebenen Stand zu veraendern', () => {
    const vorher = { a: '1' };
    const nachher = naechsteEintraegeNachWertaenderung(vorher, 'a', '9');
    expect(vorher).toEqual({ a: '1' });
    expect(nachher).not.toBe(vorher);
  });
});
