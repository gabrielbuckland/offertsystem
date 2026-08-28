import { describe, expect, it } from 'vitest';
import { berechneAufwandindikator } from '../../src/pipeline/stufe4-gewichtung.js';
import { normalisierungErgebnis, standardKonfiguration } from '../helper/projekt.js';
import { dokumentiere } from '../helper/dokumentiere.js';
import { faktorId } from '../../src/domain/ids.js';
import { gewicht } from '../../src/domain/geld.js';

describe('Stufe 4 — berechneAufwandindikator (eq:aufwandindikator)', () => {
  it('bildet D = Summe w_d * x_dach_d', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Vier normierte Faktoren 0.2/0.4/0.3/0.5 mit den Standardgewichten 0.40/0.25/0.20/0.15',
      schritte: 'berechneAufwandindikator ausführen',
      erwartung: 'D ist 0.315 (Rechenbeispiel Anhang A4) bei Gewichtssumme 1',
      anforderung: 'A-03',
    });
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

  it('weist den Einzelbeitrag je Faktor aus (A-13, 3.3.5)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Vier normierte Faktoren mit den Standardgewichten',
      schritte: 'Stufe 4 ausführen und die Beitragsliste inspizieren',
      erwartung: 'Der Beitrag von lage_gesamt ist 0.08; die Beiträge stehen sortiert nach FaktorId',
      anforderung: 'A-13',
    });
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

  it('liefert D = 0 bei allen x_dach = 0 und D = 1 bei allen x_dach = 1 (I-12)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Alle normierten Faktoren auf 0 beziehungsweise alle auf 1',
      schritte: 'Stufe 4 für beide Randbelegungen ausführen',
      erwartung: 'D ist 0 beziehungsweise 1; der Wertebereich wird ausgeschöpft',
      invariante: 'I-12',
    });
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

  it('bricht bei Gewichtssumme ungleich eins ab und normiert nicht — S-05', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Konfiguration mit projektumfang-Gewicht 0.05, also Gewichtssumme 0.9',
      schritte: 'Stufe 4 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler GEWICHTSSUMME_UNGUELTIG in Stufe 4 mit Summe 0.9 und der Faktorliste; keine stille Normierung',
    });
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

  it('akzeptiert die Summe innerhalb der Toleranz aus invariants.json (1e-9)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Konfiguration mit projektumfang-Gewicht 0.15 + 5e-10, also Summe knapp neben 1',
      schritte: 'Stufe 4 ausführen',
      erwartung: 'Ergebnis ok; die Abweichung liegt innerhalb der Toleranz 1e-9',
    });
    const basis = standardKonfiguration();
    const faktoren = new Map(basis.faktoren);
    faktoren.set(faktorId('projektumfang'),
      { ...faktoren.get(faktorId('projektumfang'))!, gewicht: gewicht(0.15 + 5e-10) });
    const r = berechneAufwandindikator(normalisierungErgebnis({ lage_gesamt: 0,
      innenausbau_qualitaet: 0, preissegment: 0, projektumfang: 0 }), { ...basis, faktoren });
    expect(r.ok).toBe(true);
  });

  it('uebernimmt eine Uebersteuerung als D und weist die Ableitung weiter aus', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Vier normierte Faktoren mit abgeleitetem D 0.315 und Übersteuerung 0.7',
      schritte: 'Stufe 4 mit Übersteuerungsargument ausführen',
      erwartung: 'D ist 0.7; der abgeleitete Wert 0.315 und alle vier Faktorbeiträge bleiben ausgewiesen',
    });
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

  it('traegt ohne Uebersteuerung KEIN Uebersteuerungsfeld (Anwesenheit entscheidet)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Vier normierte Faktoren ohne Übersteuerungsargument',
      schritte: 'Stufe 4 ausführen und die Felder des Ergebnisses prüfen',
      erwartung: 'Das Feld uebersteuerung fehlt im Ergebnis',
    });
    const r = berechneAufwandindikator(
      normalisierungErgebnis({ lage_gesamt: 0.2, innenausbau_qualitaet: 0.4,
        preissegment: 0.3, projektumfang: 0.5 }),
      standardKonfiguration());
    if (r.ok) expect('uebersteuerung' in r.wert).toBe(false);
  });

  it('unterscheidet Lagescore, Vermarkterfaktor, Preissegment und Projektumfang nicht (I-13)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Quelltext der Funktion berechneAufwandindikator',
      schritte: 'Den Funktionsquelltext auf Faktorliterale durchsuchen',
      erwartung: 'Kein faktorspezifisches Literal kommt vor; alle Faktoren laufen durch denselben Pfad',
      invariante: 'I-13',
    });
    const quelltext = String(berechneAufwandindikator);
    for (const literal of ['lage_gesamt', 'innenausbau', 'preissegment', 'projektumfang']) {
      expect(quelltext).not.toContain(literal);
    }
  });
});
