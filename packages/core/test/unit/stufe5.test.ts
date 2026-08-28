import { describe, expect, it } from 'vitest';
import { bildeHonorarrange } from '../../src/pipeline/stufe5-honorar.js';
import { gewichtungErgebnis, standardKonfiguration, verkaufssummeErgebnis } from '../helper/projekt.js';
import { dokumentiere } from '../helper/dokumentiere.js';
import { rappen } from '../../src/domain/geld.js';

const k = standardKonfiguration();

describe('Stufe 5 — bildeHonorarrange (eq:honorar_mapping)', () => {
  it('waehlt die Stufe mit V_k_min <= V < V_k_max und interpoliert linear', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'V 750 000 000 Rappen (Mitte der Stufe [5, 10) Mio. CHF) und D 0.5',
      schritte: 'bildeHonorarrange mit der Standardkonfiguration ausführen',
      erwartung: 'Stufenindex 1, Interpolationsanteil 0.5, linear interpolierte Basen und Honorarrange 153 750 bis 205 000 CHF in Rappen',
      anforderung: 'A-04',
    });
    // V = 7 500 000 CHF = 750 000 000 Rappen, Stufe k = 1 [5, 10) Mio.
    const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(750_000_000)),
      gewichtungErgebnis(0.5), k);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.stufenindex).toBe(1);
      expect(r.wert.interpolationsanteil).toBeCloseTo(0.5, 12);
      expect(r.wert.basisMax).toBeCloseTo((150_000 + 0.5 * (260_000 - 150_000)) * 100, 6);
      expect(r.wert.basisMin).toBeCloseTo((112_500 + 0.5 * (195_000 - 112_500)) * 100, 6);
      expect(r.wert.skalierung).toBeCloseTo(1.0, 12);
      expect(r.wert.honorarMax).toBe(20_500_000); // 205 000 CHF
      expect(r.wert.honorarMin).toBe(15_375_000);
    }
  });

  it('haelt die Stetigkeit an der Stufengrenze (I-20)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'V einen Rappen unter beziehungsweise genau auf der Stufengrenze 10 Mio. CHF, D 0.5',
      schritte: 'Stufe 5 für beide Werte ausführen und die Basen vergleichen',
      erwartung: 'Rechts der Grenze gilt Stufenindex 2; basisMax unterscheidet sich um weniger als einen Rappen',
      invariante: 'I-20',
    });
    const links = bildeHonorarrange(verkaufssummeErgebnis(rappen(999_999_999)),
      gewichtungErgebnis(0.5), k);
    const rechts = bildeHonorarrange(verkaufssummeErgebnis(rappen(1_000_000_000)),
      gewichtungErgebnis(0.5), k);
    if (links.ok && rechts.ok) {
      expect(rechts.wert.stufenindex).toBe(2);
      expect(Math.abs(rechts.wert.basisMax - links.wert.basisMax)).toBeLessThan(1);
    }
  });

  it('fuehrt beide Enden der Stufe, damit die Interpolation nachrechenbar bleibt (E-19)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'V 750 000 000 Rappen und D 0.5',
      schritte: 'Stufe 5 ausführen und das mitgeführte Stufenobjekt inspizieren',
      erwartung: 'Das Ergebnis trägt beide Stützstellen der Stufe (vMin/vMax mit hMin/hMax je Ende)',
    });
    const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(750_000_000)),
      gewichtungErgebnis(0.5), k);
    if (r.ok) {
      expect(r.wert.stufe).toMatchObject({
        vMin: 500_000_000, vMax: 1_000_000_000,
        hMinK: 11_250_000, hMinK1: 19_500_000,
        hMaxK: 15_000_000, hMaxK1: 26_000_000,
      });
    }
  });

  it('haelt basisMin/basisMax ungerundet (E-09) und rundet erst nach g(D) (R3)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'V 753 000 001 Rappen und D 0.317, damit die Interpolation einen echten Bruchteil ergibt',
      schritte: 'Stufe 5 ausführen und Basen sowie Honorarwerte auf Ganzzahligkeit prüfen',
      erwartung: 'basisMin ist nicht ganzzahlig; honorarMin und honorarMax sind ganzzahlig in Rappen',
    });
    // V = 753 000 001 statt der 753 000 000 des Plans: Bei 753 000 000 ist
    // t = 0.506 und die Interpolation trifft zufaellig eine ganze Zahl
    // (11 250 000 + 0.506 * 8 250 000 = 15 424 500). Der Test wuerde dann
    // fehlschlagen, ohne dass eine Rundung stattgefunden haette — er pruefte
    // nicht, was er behauptet. Ein Rappen mehr erzwingt einen echten Bruchteil.
    const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(753_000_001)),
      gewichtungErgebnis(0.317), k);
    if (r.ok) {
      expect(Number.isInteger(r.wert.basisMin)).toBe(false);
      expect(Number.isInteger(r.wert.honorarMin)).toBe(true);
      expect(Number.isInteger(r.wert.honorarMax)).toBe(true);
    }
  });

  it('wendet g(D) als gemeinsamen Faktor an — die relative Rangebreite bleibt (I-17)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Gleiches V 750 000 000 Rappen mit D 0.1 und D 0.9',
      schritte: 'Stufe 5 für beide D ausführen und relative Rangebreiten sowie Skalierung vergleichen',
      erwartung: 'Die relative Rangebreite ist gleich; die Skalierung wächst mit D',
      invariante: 'I-17',
    });
    const a = bildeHonorarrange(verkaufssummeErgebnis(rappen(750_000_000)), gewichtungErgebnis(0.1), k);
    const b = bildeHonorarrange(verkaufssummeErgebnis(rappen(750_000_000)), gewichtungErgebnis(0.9), k);
    if (a.ok && b.ok) {
      const wa = (a.wert.honorarMax - a.wert.honorarMin) / a.wert.honorarMin;
      const wb = (b.wert.honorarMax - b.wert.honorarMin) / b.wert.honorarMin;
      expect(Math.abs(wa - wb)).toBeLessThan(1e-6);
      expect(a.wert.skalierung).toBeLessThan(b.wert.skalierung);
    }
  });

  it('rechnet V auf der letzten Stuetzstelle regulaer (E-04, Spec 06 §2.4)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'V genau auf der letzten Stützstelle 20 000 000 000 Rappen, D 0.5',
      schritte: 'Stufe 5 ausführen',
      erwartung: 'Ergebnis ok mit Stufenindex 5, Interpolationsanteil 1 und basisMax 2 000 000 CHF in Rappen',
    });
    const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(20_000_000_000)),
      gewichtungErgebnis(0.5), k);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.stufenindex).toBe(5);
      expect(r.wert.interpolationsanteil).toBe(1);
      expect(r.wert.basisMax).toBeCloseTo(200_000_000, 6); // 2 000 000 CHF in Rappen
    }
  });

  it('bricht oberhalb der letzten Stuetzstelle definiert ab — S-10, keine Extrapolation', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'V einen Rappen oberhalb der letzten Stützstelle',
      schritte: 'Stufe 5 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler VERKAUFSSUMME_AUSSERHALB in Stufe 5 mit Bereich und richtung "oberhalb"; keine Extrapolation',
    });
    const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(20_000_000_001)),
      gewichtungErgebnis(0.5), k);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('VERKAUFSSUMME_AUSSERHALB');
      expect(r.fehler.stufe).toBe(5);
      expect(r.fehler.parameter).toMatchObject({
        verkaufssumme: 20_000_000_001, bereichVon: 0, bereichBis: 20_000_000_000,
        richtung: 'oberhalb',
      });
    }
  });

  it('bricht unterhalb der ersten Stuetzstelle ab — nur mit eigens konstruierter Konfiguration', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Konfiguration ohne die erste Stützstelle (Beginn bei 5 Mio. CHF) und V 1 Mio. CHF',
      schritte: 'Stufe 5 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler mit richtung "unterhalb"',
    });
    const stuetzstellen = k.honorar.stuetzstellen.slice(1); // erste Stuetzstelle bei 5 Mio.
    const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(100_000_000)),
      gewichtungErgebnis(0.5), { ...k, honorar: { ...k.honorar, stuetzstellen } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler.parameter['richtung']).toBe('unterhalb');
  });

  it('bricht bei entarteter Stufe ab — S-08, kein NaN in der Honorarrange', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Konfiguration mit zwei Stützstellen bei identischem v = 0 (entartete Stufe)',
      schritte: 'Stufe 5 mit V 0 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler STUFE_ENTARTET mit Stufenindex 0; kein NaN in der Honorarrange',
    });
    const stuetzstellen = [
      { v: rappen(0), hMin: rappen(3_000_000), hMax: rappen(4_000_000) },
      { v: rappen(0), hMin: rappen(11_250_000), hMax: rappen(15_000_000) },
    ];
    const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(0)), gewichtungErgebnis(0.5),
      { ...k, honorar: { ...k.honorar, stuetzstellen } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('STUFE_ENTARTET');
      expect(r.fehler.parameter).toMatchObject({ stufenindex: 0, wert: 0 });
    }
  });
});
