// NFA-05/US-09: Regelfall der Konfigurationserweiterung — laedt die Variante
// company-defaults.erweitert.json (zusaetzlicher Faktor risikoindex, Gewichte
// renormalisiert) und haelt sie gegen die ausgelieferte Basis, die ihn nicht fuehrt.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseKonfiguration } from '../../src/config/abbildung.js';
import { faktorId } from '../../src/domain/ids.js';
import { berechne } from '../../src/pipeline/berechne.js';
import type { Konfiguration } from '../../src/config/typen.js';
import { dokumentiere } from '../helper/dokumentiere.js';
import { szenarioZuEingangsArgumenten } from '../helper/projekt.js';
import { ladeSzenario } from '../helper/szenario.js';

function ladeKern(dateiname: string): Konfiguration {
  const pfad = fileURLToPath(new URL(`../../../../config/${dateiname}`, import.meta.url));
  const ergebnis = parseKonfiguration(JSON.parse(readFileSync(pfad, 'utf8')));
  expect(ergebnis.ok, `${dateiname} muss alle drei Pruefebenen bestehen`).toBe(true);
  if (!ergebnis.ok) throw new Error('unerreichbar');
  return ergebnis.wert.kern;
}

// risikoindex: Grenzen 1..6, gesetzter Wert 4, min-max linear: (4-1)/5 = 0.6.
const RISIKO_WERT = 4;
const ERWARTET_NORMIERT = 0.6;

describe('Konfigurationsvariante risikoindex (Regelfall der Erweiterung, NFA-05)', () => {
  const erweitert = ladeKern('company-defaults.erweitert.json');
  const basis = ladeKern('company-defaults.json');

  it('besteht die Konfigurationsprüfung und führt den zusätzlichen Faktor risikoindex (US-09)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Variantenkonfiguration company-defaults.erweitert.json auf der Platte',
      schritte: 'Die Datei laden, durch parseKonfiguration prüfen und die Faktormenge inspizieren',
      erwartung: 'Alle drei Prüfebenen bestehen; risikoindex ist als vierter Faktor mit Gewicht 0,1 geführt, die übrigen Gewichte sind renormalisiert',
    });
    const risiko = erweitert.faktoren.get(faktorId('risikoindex'));
    expect(risiko).toBeDefined();
    expect(risiko?.gewicht).toBeCloseTo(0.1, 12);
    expect(erweitert.faktoren.get(faktorId('lage_gesamt'))?.gewicht).toBeCloseTo(0.495, 12);
    expect(erweitert.faktoren.get(faktorId('preissegment'))?.gewicht).toBeCloseTo(0.225, 12);
    expect(erweitert.faktoren.get(faktorId('projektumfang'))?.gewicht).toBeCloseTo(0.18, 12);
    expect(basis.faktoren.get(faktorId('risikoindex'))).toBeUndefined();
  });

  it('macht den neuen Faktor im Pipeline-Lauf wirksam, allein über die Konfiguration', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S1, gesetzter risikoindex-Wert und die erweiterte Konfiguration',
      schritte: 'Das Szenario mit erweiterter und mit Basiskonfiguration durch alle fünf Stufen rechnen',
      erwartung: 'Beide Läufe enden grün; risikoindex trägt mit Gewicht 0,1 zum Aufwandindikator bei, die Verkaufssumme bleibt identisch',
    });
    const argumente = szenarioZuEingangsArgumenten(ladeSzenario('S1'));
    const mitWert = {
      ...argumente,
      vermarkterFaktoren: {
        werte: new Map([
          ...argumente.vermarkterFaktoren.werte,
          [faktorId('risikoindex'), RISIKO_WERT],
        ]),
      },
    };
    const mitErweitert = berechne({ ...mitWert, konfiguration: erweitert });
    const mitBasis = berechne({ ...argumente, konfiguration: basis });
    expect(mitErweitert.ok).toBe(true);
    expect(mitBasis.ok).toBe(true);
    if (!mitErweitert.ok || !mitBasis.ok) return;

    const beitrag = mitErweitert.wert.gewichtung.beitraege
      .find((b) => b.faktorId === faktorId('risikoindex'));
    expect(beitrag?.gewicht).toBeCloseTo(0.1, 12);
    expect(beitrag?.beitrag).toBeCloseTo(0.1 * ERWARTET_NORMIERT, 12);
    expect(mitBasis.wert.gewichtung.beitraege
      .some((b) => b.faktorId === faktorId('risikoindex'))).toBe(false);

    // Der Faktor wirkt nur im Aufwandzweig: Verkaufssumme (Stufen 1-2) bleibt identisch.
    expect(mitErweitert.wert.verkaufssumme.verkaufssumme)
      .toBe(mitBasis.wert.verkaufssumme.verkaufssumme);
    expect(mitErweitert.wert.gewichtung.gewichtssumme).toBeCloseTo(1, 12);
  });

  it('endet ohne gesetzten risikoindex-Wert mit Fehler statt Ergebnis', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S1 ohne Wert für risikoindex, erweiterte Konfiguration',
      schritte: 'Den Lauf mit der erweiterten Konfiguration, aber ohne den manuellen Wert starten',
      erwartung: 'Der Lauf endet mit Fehler; auf dem fehlenden Wert wird nicht weitergerechnet',
    });
    const argumente = szenarioZuEingangsArgumenten(ladeSzenario('S1'));
    const lauf = berechne({ ...argumente, konfiguration: erweitert });
    expect(lauf.ok).toBe(false);
  });
});
