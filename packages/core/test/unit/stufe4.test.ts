import { describe, expect, it } from 'vitest';
import { berechneAufwandindikator } from '../../src/pipeline/stufe4-gewichtung.js';
import { normalisierungErgebnis, standardKonfiguration } from '../helper/projekt.js';
import { faktorId } from '../../src/domain/ids.js';
import { gewicht } from '../../src/domain/geld.js';

describe('Stufe 4 — berechneAufwandindikator (eq:aufwandindikator)', () => {
  it('bildet D = Summe w_d * x_dach_d', () => {
    // Anhang A4: 0.40*0.2 + 0.25*0.4 + 0.20*0.3 + 0.15*0.5 = 0.08+0.10+0.06+0.075 = 0.315
    const r = berechneAufwandindikator(
      normalisierungErgebnis({ lage_gesamt: 0.2, innenausbau_qualitaet: 0.4,
        preissegment: 0.3, projektumfang: 0.5 }),
      standardKonfiguration());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.aufwandindikator).toBeCloseTo(0.315, 12);
      expect(r.wert.gewichtssumme).toBeCloseTo(1, 12);
    }
  });

  it('weist den Einzelbeitrag je Faktor aus (A-13, 3.3.5)', () => {
    const r = berechneAufwandindikator(
      normalisierungErgebnis({ lage_gesamt: 0.2, innenausbau_qualitaet: 0.4,
        preissegment: 0.3, projektumfang: 0.5 }),
      standardKonfiguration());
    if (r.ok) {
      const lage = r.wert.beitraege.find((b) => b.faktorId === faktorId('lage_gesamt'))!;
      expect(lage.beitrag).toBeCloseTo(0.08, 12);
      expect(r.wert.beitraege.map((b) => b.faktorId))
        .toEqual([...r.wert.beitraege.map((b) => b.faktorId)].sort());
    }
  });

  it('liefert D = 0 bei allen x_dach = 0 und D = 1 bei allen x_dach = 1 (I-12)', () => {
    const k = standardKonfiguration();
    const null_ = berechneAufwandindikator(normalisierungErgebnis({ lage_gesamt: 0,
      innenausbau_qualitaet: 0, preissegment: 0, projektumfang: 0 }), k);
    const eins = berechneAufwandindikator(normalisierungErgebnis({ lage_gesamt: 1,
      innenausbau_qualitaet: 1, preissegment: 1, projektumfang: 1 }), k);
    if (null_.ok && eins.ok) {
      expect(null_.wert.aufwandindikator).toBe(0);
      expect(eins.wert.aufwandindikator).toBeCloseTo(1, 12);
    }
  });

  it('bricht bei Gewichtssumme ungleich eins ab und normiert nicht — S-05', () => {
    const basis = standardKonfiguration();
    const faktoren = new Map(basis.faktoren);
    faktoren.set(faktorId('projektumfang'),
      { ...faktoren.get(faktorId('projektumfang'))!, gewicht: gewicht(0.05) });
    const r = berechneAufwandindikator(
      normalisierungErgebnis({ lage_gesamt: 0.2, innenausbau_qualitaet: 0.4,
        preissegment: 0.3, projektumfang: 0.5 }),
      { ...basis, faktoren });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('GEWICHTSSUMME_UNGUELTIG');
      expect(r.fehler.stufe).toBe(4);
      expect(r.fehler.parameter['summe']).toBeCloseTo(0.9, 12);
      expect(r.fehler.parameter['faktoren']).toContain('projektumfang|Projektumfang (Anzahl Einheiten)|0.05');
    }
  });

  it('akzeptiert die Summe innerhalb der Toleranz aus invariants.json (1e-9)', () => {
    const basis = standardKonfiguration();
    const faktoren = new Map(basis.faktoren);
    faktoren.set(faktorId('projektumfang'),
      { ...faktoren.get(faktorId('projektumfang'))!, gewicht: gewicht(0.15 + 5e-10) });
    const r = berechneAufwandindikator(normalisierungErgebnis({ lage_gesamt: 0,
      innenausbau_qualitaet: 0, preissegment: 0, projektumfang: 0 }), { ...basis, faktoren });
    expect(r.ok).toBe(true);
  });

  it('uebernimmt eine Uebersteuerung als D und weist die Ableitung weiter aus', () => {
    const r = berechneAufwandindikator(
      normalisierungErgebnis({ lage_gesamt: 0.2, innenausbau_qualitaet: 0.4,
        preissegment: 0.3, projektumfang: 0.5 }),
      standardKonfiguration(), 0.7);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.aufwandindikator).toBe(0.7);
      expect(r.wert.uebersteuerung?.abgeleitet).toBeCloseTo(0.315, 12);
      // Die Faktorspuren bleiben vollstaendig — Vorschlag und Herleitung (US-13).
      expect(r.wert.beitraege).toHaveLength(4);
    }
  });

  it('traegt ohne Uebersteuerung KEIN Uebersteuerungsfeld (Anwesenheit entscheidet)', () => {
    const r = berechneAufwandindikator(
      normalisierungErgebnis({ lage_gesamt: 0.2, innenausbau_qualitaet: 0.4,
        preissegment: 0.3, projektumfang: 0.5 }),
      standardKonfiguration());
    if (r.ok) expect('uebersteuerung' in r.wert).toBe(false);
  });

  it('unterscheidet Lagescore, Vermarkterfaktor, Preissegment und Projektumfang nicht (I-13)', () => {
    const quelltext = String(berechneAufwandindikator);
    for (const literal of ['lage_gesamt', 'innenausbau', 'preissegment', 'projektumfang']) {
      expect(quelltext).not.toContain(literal);
    }
  });
});
