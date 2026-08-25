import { describe, expect, it } from 'vitest';
import { pruefeEbene3 } from '../../src/config/ebene3.js';
import { BASIS_KONFIGURATION, baueKonfiguration } from '../konfigurations-bauer.js';

const codes = (konfiguration: Parameters<typeof pruefeEbene3>[0]): string[] =>
  pruefeEbene3(konfiguration).map((f) => f.code);

describe('Ebene 3 — fachliche Invarianten', () => {
  it('nimmt die Standardkonfiguration ohne Befund an', () => {
    expect(pruefeEbene3(BASIS_KONFIGURATION)).toEqual([]);
  });

  it('meldet eine Gewichtssumme ungleich 1 mit allen Einzelbeitraegen', () => {
    const befunde = pruefeEbene3(baueKonfiguration((k) => {
      k.aufwandfaktoren['lage_gesamt']!.gewicht = 0.34;
    }));
    const treffer = befunde.find((f) => f.code === 'CFG_WEIGHTS_SUM');
    expect(treffer).toBeDefined();
    expect(treffer?.parameter['summe']).toBeCloseTo(0.94, 10);
    expect(treffer?.parameter['anzahl']).toBe(4);
    expect(String(treffer?.parameter['einzelbeitraege'])).toContain('lage_gesamt');
  });

  it('meldet eine leere Faktormenge', () => {
    expect(codes(baueKonfiguration((k) => { k.aufwandfaktoren = {}; })))
      .toContain('CFG_WEIGHTS_SUM');
  });

  it('meldet eine nicht streng aufsteigende Stuetzstellenfolge', () => {
    const befunde = pruefeEbene3(baueKonfiguration((k) => {
      k.honorar.stuetzstellen[4]!.v = 2000000000;
    }));
    expect(befunde.map((f) => f.code)).toContain('CFG_TIER_ORDER');
  });

  it('meldet eine fehlende abschliessende Stuetzstelle', () => {
    expect(codes(baueKonfiguration((k) => {
      k.honorar.stuetzstellen = [{ v: 0, hMin: 3000000, hMax: 4000000 }];
    }))).toContain('CFG_TIER_OPEN');
  });

  it('meldet einen Bildbereich von g ohne die 1', () => {
    expect(codes(baueKonfiguration((k) => {
      k.honorar.skalierung.gMin = 1;
      k.honorar.skalierung.gMax = 0.9;
    }))).toContain('CFG_G_ORDER');
  });

  it('meldet die z-Score-Strategie ohne Kappung', () => {
    expect(codes(baueKonfiguration((k) => {
      k.aufwandfaktoren['innenausbau_qualitaet']!.strategie = 'zscore';
    }))).toContain('CFG_ZSCORE_CAP');
  });

  it('nimmt die z-Score-Strategie mit Kappung an', () => {
    expect(codes(baueKonfiguration((k) => {
      const faktor = k.aufwandfaktoren['innenausbau_qualitaet']!;
      faktor.strategie = 'zscore';
      faktor.referenzverteilung = { mittelwert: 3.5, standardabweichung: 1.2, kappungSigma: 2 };
    }))).not.toContain('CFG_ZSCORE_CAP');
  });

  it('meldet einen nicht aufloesbaren Quellschluessel', () => {
    const befunde = pruefeEbene3(baueKonfiguration((k) => {
      k.aufwandfaktoren['lage_gesamt']!.quellSchluessel = 'lage_gesamt';
    }));
    const treffer = befunde.find((f) => f.code === 'CFG_SOURCE_UNRESOLVED');
    expect(treffer?.parameter['quelle']).toBe('lagescore');
    expect(treffer?.parameter['quellSchluessel']).toBe('lage_gesamt');
  });

  it('kennt die Ableitung nur unter dem Namen einheitenzahl, nicht unter projektumfang', () => {
    // Der Faktorschluessel bleibt `projektumfang`; als QUELLschluessel ist er
    // nach E-05/PE-03 kein gueltiger Ableitungsname mehr.
    const befunde = pruefeEbene3(baueKonfiguration((k) => {
      k.aufwandfaktoren['projektumfang']!.quellSchluessel = 'projektumfang';
    }));
    const treffer = befunde.find((f) => f.code === 'CFG_SOURCE_UNRESOLVED');
    expect(treffer?.pfad).toBe('aufwandfaktoren.projektumfang.quellSchluessel');
    expect(String(treffer?.parameter['verfuegbar'])).toContain('einheitenzahl');
  });

  it('meldet eine Vorlage ausserhalb der Anpassungsgrenzen', () => {
    expect(codes(baueKonfiguration((k) => {
      k.anpassungsVorlagen[0]!.vorgabefaktor = 0.4;
    }))).toContain('CFG_TEMPLATE_BOUNDS');
  });

  it('meldet eine Vorlage mit zu kurzem Begruendungsvorschlag', () => {
    expect(codes(baueKonfiguration((k) => {
      k.anpassungsVorlagen[0]!.begruendungVorschlag = 'ok';
    }))).toContain('CFG_TEMPLATE_BOUNDS');
  });

  it('meldet doppelte Vorlagenbezeichner', () => {
    expect(codes(baueKonfiguration((k) => {
      k.anpassungsVorlagen.push(structuredClone(k.anpassungsVorlagen[0]!));
    }))).toContain('CFG_TEMPLATE_BOUNDS');
  });

  it('reicht Degressionsbefunde durch', () => {
    expect(codes(baueKonfiguration((k) => { k.honorar.stuetzstellen[1]!.hMax = 5000000; })))
      .toContain('CFG_TIER_DEGRESSION');
  });
});

function mitVorlage(vorlage: unknown) {
  return baueKonfiguration((k) => {
    (k as unknown as Record<string, unknown>)['merkmale'] =
      [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' }];
    (k as unknown as Record<string, unknown>)['anpassungsVorlagen'] = [vorlage];
  });
}

const GUELTIG = {
  id: 'stockwerklage',
  bezeichnung: 'Zuschlag Stockwerk',
  vorgabefaktor: 0,
  erfassungsform: 'relativ',
  begruendungVorschlag: 'Zuschlag fuer die Stockwerklage gemaess firmenweiter Staffel.',
  regel: {
    merkmal: 'stockwerk',
    bereiche: [{ unter: 1, wert: 0 }, { unter: 2, wert: 0.05 }, { wert: 0.1 }],
  },
};

describe('pruefeEbene3 — Bereichsregeln', () => {
  it('nimmt eine gueltige Regel an', () => {
    const befunde = pruefeEbene3(mitVorlage(GUELTIG));
    expect(befunde.filter((f) => f.code === 'CFG_BEREICHSREGEL')).toEqual([]);
  });

  it('weist eine Regel auf ein unbekanntes Merkmal zurueck', () => {
    const befunde = pruefeEbene3(mitVorlage({
      ...GUELTIG, regel: { ...GUELTIG.regel, merkmal: 'gibtsnicht' },
    }));
    expect(befunde.some((f) => f.code === 'CFG_BEREICHSREGEL')).toBe(true);
  });

  it('weist eine Staffel ohne Restfall zurueck', () => {
    const befunde = pruefeEbene3(mitVorlage({
      ...GUELTIG, regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }] },
    }));
    expect(befunde.some((f) => f.code === 'CFG_BEREICHSREGEL')).toBe(true);
  });

  it('weist einen relativen Bereichswert ausserhalb der z-Grenzen zurueck', () => {
    const befunde = pruefeEbene3(mitVorlage({
      ...GUELTIG,
      regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }, { wert: 9 }] },
    }));
    expect(befunde.some((f) => f.code === 'CFG_BEREICHSREGEL')).toBe(true);
  });

  it('verlangt bei absoluter Erfassungsform ganzzahlige Rappen', () => {
    const befunde = pruefeEbene3(mitVorlage({
      ...GUELTIG,
      erfassungsform: 'absolut',
      regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }, { wert: 10.5 }] },
    }));
    expect(befunde.some((f) => f.code === 'CFG_BEREICHSREGEL')).toBe(true);
  });

  it('weist Regel und Vorgabewert nebeneinander zurueck', () => {
    const befunde = pruefeEbene3(mitVorlage({ ...GUELTIG, vorgabefaktor: 0.05 }));
    expect(befunde.some((f) => f.code === 'CFG_BEREICHSREGEL')).toBe(true);
  });
});
