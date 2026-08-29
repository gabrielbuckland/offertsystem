// Sonderfall-Messung des Erweiterungsszenarios (docs/testdoku/erweiterung-risikoindex.md):
// laedt die Konfigurationsvariante config/company-defaults.strategie.json (preissegment
// auf wurzel-min-max, gleiche Grenzen) und rechnet einen vollstaendigen Pipeline-Lauf.
// Die ausgelieferte company-defaults.json bleibt unveraendert auf min-max — beide
// Fassungen werden hier gegeneinander gehalten.
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

// S1: q-quer = 85_000_000 / 92.5 Rappen/m^2; Grenzen 600_000..1_800_000. Erwartungen
// von Hand: linear (q-600000)/1200000, Wurzel (sqrt q - sqrt 600000)/(sqrt 1800000 - sqrt 600000).
const ERWARTET_LINEAR = 0.26576576576576577;
const ERWARTET_WURZEL = 0.32450017855222796;

describe('Konfigurationsvariante wurzel-min-max (Sonderfall-Messung)', () => {
  const variante = ladeKern('company-defaults.strategie.json');
  const basis = ladeKern('company-defaults.json');

  it('besteht die Konfigurationsprüfung und führt preissegment auf wurzel-min-max', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Variantenkonfiguration company-defaults.strategie.json auf der Platte',
      schritte: 'Die Datei laden, durch parseKonfiguration prüfen und den Faktor preissegment inspizieren',
      erwartung: 'Alle drei Prüfebenen bestehen; preissegment nutzt wurzel-min-max mit unveränderten Grenzen',
    });
    const preissegment = variante.faktoren.get(faktorId('preissegment'));
    expect(preissegment?.strategie).toBe('wurzel-min-max');
    expect(preissegment?.grenzeMin).toBe(600_000);
    expect(preissegment?.grenzeMax).toBe(1_800_000);
    expect(variante.meta.konfigVersion).toBe('1.1.0-strategie-vorlaeufig');
  });

  it('lässt die ausgelieferte Basiskonfiguration unberührt auf min-max', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Ausgelieferte company-defaults.json auf der Platte',
      schritte: 'Die Basiskonfiguration laden und den Faktor preissegment inspizieren',
      erwartung: 'preissegment nutzt weiterhin min-max; die Variante ist eine getrennte Datei',
    });
    expect(basis.faktoren.get(faktorId('preissegment'))?.strategie).toBe('min-max');
  });

  it('rechnet einen Pipeline-Lauf mit wurzel-min-max grün durch — Kernstufen unberührt', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S1 und die Variantenkonfiguration mit wurzel-min-max',
      schritte: 'Das Szenario mit Varianten- und Basiskonfiguration durch alle fünf Stufen rechnen',
      erwartung: 'Beide Läufe enden grün; preissegment normiert auf der Wurzel- bzw. Linearskala, Verkaufssumme identisch, Honorarrange ausgewiesen',
      invariante: 'I-22',
    });
    const argumente = szenarioZuEingangsArgumenten(ladeSzenario('S1'));
    const mitVariante = berechne({ ...argumente, konfiguration: variante });
    const mitBasis = berechne({ ...argumente, konfiguration: basis });
    expect(mitVariante.ok).toBe(true);
    expect(mitBasis.ok).toBe(true);
    if (!mitVariante.ok || !mitBasis.ok) return;

    const normiert = (lauf: typeof mitVariante.wert): number | undefined =>
      lauf.normalisierung.faktoren
        .find((f) => f.faktorId === faktorId('preissegment'))?.normiert;
    expect(normiert(mitVariante.wert)).toBeCloseTo(ERWARTET_WURZEL, 12);
    expect(normiert(mitBasis.wert)).toBeCloseTo(ERWARTET_LINEAR, 12);

    // Die Strategie wirkt erst ab Stufe 3: Verkaufssumme (Stufen 1-2) bleibt identisch,
    // die Honorarrange bleibt eine gueltige, positive Range.
    expect(mitVariante.wert.verkaufssumme.verkaufssumme)
      .toBe(mitBasis.wert.verkaufssumme.verkaufssumme);
    expect(mitVariante.wert.honorar.honorarMin).toBeGreaterThan(0);
    expect(mitVariante.wert.honorar.honorarMax)
      .toBeGreaterThanOrEqual(mitVariante.wert.honorar.honorarMin);
    for (const f of mitVariante.wert.normalisierung.faktoren) {
      expect(f.normiert).toBeGreaterThanOrEqual(0);
      expect(f.normiert).toBeLessThanOrEqual(1);
    }
  });
});
