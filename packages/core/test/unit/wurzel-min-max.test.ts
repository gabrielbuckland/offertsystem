// Unit-Tests der Sonderfall-Strategie wurzel-min-max (Erweiterungsszenario).
// Grenzfaelle nach dem Muster von normalisierung.test.ts; Metadaten fuer
// Anhang E via dokumentiere.
import { describe, expect, it } from 'vitest';
import { alleStrategien, loeseStrategieAuf } from '../../src/normalization/registry.js';
import { gewicht } from '../../src/domain/geld.js';
import { faktorId } from '../../src/domain/ids.js';
import type { FaktorParameter } from '../../src/config/typen.js';
import { dokumentiere } from '../helper/dokumentiere.js';

// Grenzen 100..400 liegen auf Quadratzahlen: sqrt(100) = 10, sqrt(400) = 20 — die
// Erwartungswerte sind damit exakt von Hand nachrechenbar.
const p = (u: Partial<FaktorParameter> = {}): FaktorParameter => ({
  grenzeMin: 100, grenzeMax: 400, gewicht: gewicht(0.5), strategie: 'wurzel-min-max',
  quelle: 'manuell', quellSchluessel: 'f', bezeichnung: 'Testfaktor', ...u,
});

describe('Wurzel-Min-Max — eq:normalisierung auf der Wurzelskala', () => {
  const s = loeseStrategieAuf('wurzel-min-max');

  it('bildet die Grenzen auf 0 und 1 und die Wurzelskalen-Mitte auf 0.5 ab', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Faktorparameter mit Grenzen 100 und 400 (Wurzeln 10 und 20)',
      schritte: 'Die Rohwerte 100, 400 und 225 normalisieren',
      erwartung: 'Die Grenzen ergeben 0 und 1; der Wert 225 (Wurzel 15) liegt exakt in der Mitte 0.5',
      invariante: 'I-22',
    });
    const unten = s.normalisiere(100, p(), faktorId('f'));
    const oben = s.normalisiere(400, p(), faktorId('f'));
    const mitte = s.normalisiere(225, p(), faktorId('f'));
    expect(unten.ok && oben.ok && mitte.ok).toBe(true);
    if (unten.ok && oben.ok && mitte.ok) {
      expect(unten.wert.normiert).toBeCloseTo(0, 12);
      expect(oben.wert.normiert).toBeCloseTo(1, 12);
      expect(mitte.wert.normiert).toBeCloseTo(0.5, 12);
      expect(mitte.wert.gekappt).toBe(false);
    }
  });

  it('staucht den oberen Randbereich gegenüber der linearen Abbildung', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Derselbe Rohwert 225 unter wurzel-min-max und min-max',
      schritte: 'Beide Strategien mit identischen Grenzen 100..400 auswerten',
      erwartung: 'Die Wurzelvariante liegt mit 0.5 über dem linearen Wert von rund 0.4167',
    });
    const wurzel = s.normalisiere(225, p(), faktorId('f'));
    const linear = loeseStrategieAuf('min-max')
      .normalisiere(225, p({ strategie: 'min-max' }), faktorId('f'));
    if (wurzel.ok && linear.ok) {
      expect(linear.wert.normiert).toBeCloseTo(125 / 300, 12);
      expect(wurzel.wert.normiert).toBeGreaterThan(linear.wert.normiert);
    }
  });

  it('kappt aussen und markiert die Kappung (I-11)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Rohwerte unterhalb der Untergrenze und oberhalb der Obergrenze',
      schritte: 'Die Rohwerte 25 und 2500 mit Grenzen 100..400 normalisieren',
      erwartung: 'Ergebnisse 0 und 1, jeweils als gekappt ausgewiesen',
      invariante: 'I-11',
    });
    const unten = s.normalisiere(25, p(), faktorId('f'));
    const oben = s.normalisiere(2500, p(), faktorId('f'));
    if (unten.ok && oben.ok) {
      expect(unten.wert.normiert).toBe(0);
      expect(oben.wert.normiert).toBe(1);
      expect(unten.wert.gekappt).toBe(true);
      expect(oben.wert.gekappt).toBe(true);
    }
  });

  it('behandelt einen negativen Rohwert als gekappt — auch bei Untergrenze 0', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Nichtnegative Grenzen 0..400 und ein negativer Rohwert',
      schritte: 'Den Rohwert -50 normalisieren',
      erwartung: 'Ergebnis 0, als gekappt ausgewiesen — kein NaN, keine Ausnahme',
      invariante: 'I-22',
    });
    const r = s.normalisiere(-50, p({ grenzeMin: 0 }), faktorId('f'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.normiert).toBe(0);
      expect(r.wert.gekappt).toBe(true);
    }
  });

  it('poled allein über vertauschte Grenzen um, ohne die Grenzen zu sortieren', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Vertauschte Grenzen 400..100 (Umpolung nach Brief §4)',
      schritte: 'Den Rohwert 225 normalisieren und die ausgewiesenen Grenzen prüfen',
      erwartung: 'Ergebnis 0.5 gespiegelt; grenzeMin und grenzeMax bleiben wie konfiguriert',
    });
    const r = s.normalisiere(225, p({ grenzeMin: 400, grenzeMax: 100 }), faktorId('f'));
    if (r.ok) {
      expect(r.wert.normiert).toBeCloseTo(0.5, 12);
      expect(r.wert.grenzeMin).toBe(400);
      expect(r.wert.grenzeMax).toBe(100);
    }
    const nahUnten = s.normalisiere(380, p({ grenzeMin: 400, grenzeMax: 100 }), faktorId('f'));
    if (nahUnten.ok) expect(nahUnten.wert.normiert).toBeLessThan(0.5);
  });

  it('meldet S-01 bei identischen Grenzen und setzt keinen Ersatzwert', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Identische Grenzen 300..300',
      schritte: 'Einen beliebigen Rohwert normalisieren',
      erwartung: 'StufenFehler NORM_GRENZEN_IDENTISCH auf Stufe 3, kein Ergebniswert',
    });
    const r = s.normalisiere(5, p({ grenzeMin: 300, grenzeMax: 300 }), faktorId('f'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('NORM_GRENZEN_IDENTISCH');
      expect(r.fehler.stufe).toBe(3);
      expect(r.fehler.parameter).toMatchObject(
        { faktorId: 'f', bezeichnung: 'Testfaktor', wert: 300 });
    }
  });

  it('hält die I-22-Garantie auch für extreme endliche Rohwerte ein', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Extreme endliche Rohwerte weit ausserhalb der Grenzen',
      schritte: 'Die Rohwerte -1e12, 0, 1e-9 und 1e12 normalisieren',
      erwartung: 'Jedes Ergebnis liegt in [0, 1]',
      invariante: 'I-22',
    });
    for (const rohwert of [-1e12, 0, 1e-9, 1e12]) {
      const r = s.normalisiere(rohwert, p(), faktorId('f'));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.wert.normiert).toBeGreaterThanOrEqual(0);
        expect(r.wert.normiert).toBeLessThanOrEqual(1);
      }
    }
  });

  it('ist im Register aufgelöst und in der Aufzählung enthalten (S-07)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Das Strategieregister nach der Erweiterung',
      schritte: 'wurzel-min-max über loeseStrategieAuf auflösen und alleStrategien aufzählen',
      erwartung: 'Die Auflösung liefert die Strategie direkt; die Aufzählung enthält den Bezeichner',
    });
    expect(s.bezeichner).toBe('wurzel-min-max');
    expect(alleStrategien().map((eintrag) => eintrag.bezeichner)).toContain('wurzel-min-max');
  });
});
