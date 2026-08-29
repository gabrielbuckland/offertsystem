import { describe, expect, it } from 'vitest';
import { istUebersteuert, setzePfad, setzeZurueck } from
  '../../../src/components/einstellungen/herkunft.js';

describe('istUebersteuert', () => {
  it('erkennt einen gesetzten Blattpfad', () => {
    expect(istUebersteuert({ flaeche: { alpha: 0.6 } }, 'flaeche.alpha')).toBe(true);
  });

  it('meldet einen nicht gesetzten Pfad als firmenweit', () => {
    expect(istUebersteuert({ flaeche: { alpha: 0.6 } }, 'preisanpassung.zMin')).toBe(false);
  });

  it('meldet einen Elternpfad als uebersteuert, wenn ein Kind gesetzt ist', () => {
    expect(istUebersteuert({ honorar: { skalierung: { gMax: 1.2 } } }, 'honorar')).toBe(true);
  });

  it('behandelt ein leeres Delta durchgaengig als firmenweit', () => {
    expect(istUebersteuert({}, 'flaeche.alpha')).toBe(false);
    expect(istUebersteuert(undefined, 'flaeche.alpha')).toBe(false);
  });
});

describe('setzePfad', () => {
  it('legt verschachtelte Zwischenobjekte an', () => {
    expect(setzePfad({}, 'honorar.skalierung.gMax', 1.2))
      .toEqual({ honorar: { skalierung: { gMax: 1.2 } } });
  });

  it('laesst Geschwister im Delta unangetastet', () => {
    const vorher = { flaeche: { alpha: 0.6 } };
    expect(setzePfad(vorher, 'preisanpassung.zMin', -0.3))
      .toEqual({ flaeche: { alpha: 0.6 }, preisanpassung: { zMin: -0.3 } });
    // Keine Mutation der Eingabe.
    expect(vorher).toEqual({ flaeche: { alpha: 0.6 } });
  });
});

describe('setzeZurueck', () => {
  it('entfernt den Pfad und raeumt leer gewordene Eltern ab', () => {
    expect(setzeZurueck({ honorar: { skalierung: { gMax: 1.2 } } }, 'honorar.skalierung.gMax'))
      .toEqual({});
  });

  it('behaelt Geschwister unter demselben Elternteil', () => {
    expect(setzeZurueck({ flaeche: { alpha: 0.6 }, preisanpassung: { zMin: -0.3 } },
      'flaeche.alpha')).toEqual({ preisanpassung: { zMin: -0.3 } });
  });
});
