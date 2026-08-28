import { describe, expect, it } from 'vitest';
import { berechneVerkaufssumme } from '../../src/pipeline/stufe2-verkaufssumme.js';
import { pipelineEingang } from '../helper/projekt.js';
import { dokumentiere } from '../helper/dokumentiere.js';

describe('Stufe 2 — berechneVerkaufssumme (eq:flaeche, eq:qm_preis, eq:wohnungspreis, eq:verkaufssumme)', () => {
  it('bildet q_t ungerundet und p_j auf ganze Rappen gerundet (R2)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Referenzbewertung 85 000 000 Rappen bei 92.5 m2, alpha 0.5, keine Aussenfläche',
      schritte: 'berechneVerkaufssumme ausführen und Quadratmeterpreis sowie Positionspreise prüfen',
      erwartung: 'q_t bleibt ungerundet (nicht ganzzahlig); jeder Positionspreis ist ganzzahlig in Rappen',
    });
    // P_ref = 85 000 000 Rappen, A_ref = 92.5 m^2, alpha = 0.5, A_aussen = 0
    const r = berechneVerkaufssumme(pipelineEingang());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const t = r.wert.typAbleitungen[0]!;
      expect(t.quadratmeterpreis).toBeCloseTo(85_000_000 / 92.5, 9);
      expect(Number.isInteger(t.quadratmeterpreis)).toBe(false);
      for (const p of r.wert.positionen) expect(Number.isInteger(p.preis)).toBe(true);
    }
  });

  it('haelt I-05 exakt: Referenzflaechen und keine Anpassungen ergeben P_ref', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Einheiten mit Referenzflächen und ohne Zu-/Abschläge',
      schritte: 'Stufe 2 ausführen und alle Positionspreise vergleichen',
      erwartung: 'Jeder Positionspreis ist exakt P_ref = 85 000 000 Rappen',
      invariante: 'I-05',
    });
    const r = berechneVerkaufssumme(pipelineEingang());
    if (r.ok) for (const p of r.wert.positionen) expect(p.preis).toBe(85_000_000);
  });

  it('bildet V als exakte Ganzzahlsumme (eq:verkaufssumme)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Vier identische Einheiten zum Referenzpreis',
      schritte: 'Stufe 2 ausführen und Verkaufssumme sowie Einheitenzahl lesen',
      erwartung: 'V ist exakt 4 * 85 000 000 Rappen bei Einheitenzahl 4',
      anforderung: 'A-03',
    });
    const r = berechneVerkaufssumme(pipelineEingang());
    if (r.ok) {
      expect(r.wert.verkaufssumme).toBe(4 * 85_000_000);
      expect(r.wert.einheitenzahl).toBe(4);
    }
  });

  it('verknuepft Anpassungen additiv und reihenfolgeunabhaengig (I-08)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Erste Einheit mit zwei relativen Anpassungen +0.1 und -0.05',
      schritte: 'Stufe 2 mit beiden Anpassungsreihenfolgen ausführen und Preise vergleichen',
      erwartung: 'Gleicher Preis in beiden Reihenfolgen; Anpassungssumme 0.05; Preis = P_ref * 1.05',
      invariante: 'I-08',
    });
    const a = [{ faktor: 0.1, begruendung: 'Attikalage mit Dachterrasse', erfassungsform: 'relativ' as const },
               { faktor: -0.05, begruendung: 'Erdgeschoss stark einsehbar', erfassungsform: 'relativ' as const }];
    const vor = berechneVerkaufssumme(pipelineEingang({ anpassungenErsteEinheit: a }));
    const um = berechneVerkaufssumme(pipelineEingang({ anpassungenErsteEinheit: [a[1]!, a[0]!] }));
    expect(vor.ok && um.ok).toBe(true);
    if (vor.ok && um.ok) {
      expect(vor.wert.positionen[0]!.preis).toBe(um.wert.positionen[0]!.preis);
      expect(vor.wert.positionen[0]!.anpassungssumme).toBeCloseTo(0.05, 12);
      expect(vor.wert.positionen[0]!.preis).toBe(85_000_000 * 1.05);
    }
  });

  it('weist die Anpassungen einzeln aus (I-09, A-14)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Erste Einheit mit einer relativen Anpassung -0.05 samt Begründung',
      schritte: 'Stufe 2 ausführen und die Position der ersten Einheit inspizieren',
      erwartung: 'Die Anpassung ist einzeln mit Begründung ausgewiesen; der Basispreis steht getrennt daneben',
      invariante: 'I-09',
      anforderung: 'A-14',
    });
    const r = berechneVerkaufssumme(pipelineEingang({ anpassungenErsteEinheit: [
      { faktor: -0.05, begruendung: 'Laermexposition Strassenseite', erfassungsform: 'relativ' }] }));
    if (r.ok) {
      expect(r.wert.positionen[0]!.anpassungen).toHaveLength(1);
      expect(r.wert.positionen[0]!.anpassungen[0]!.begruendung)
        .toBe('Laermexposition Strassenseite');
      expect(r.wert.positionen[0]!.basispreis).toBeCloseTo(85_000_000, 6);
    }
  });

  it('bricht bei A_t_ref = 0 ab — S-04, kein Infinity in der Offerte', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Wohnungstyp mit gewichteter Referenzfläche 0',
      schritte: 'Stufe 2 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler REFERENZFLAECHE_NULL in Stufe 2 mit WohnungstypId, alpha und den Flächenparametern',
    });
    const r = berechneVerkaufssumme(pipelineEingang({ referenzflaecheNull: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('REFERENZFLAECHE_NULL');
      expect(r.fehler.stufe).toBe(2);
      expect(r.fehler.parameter).toMatchObject({ wohnungstypId: 'T1', alpha: 0.5 });
      expect(Object.keys(r.fehler.parameter)).toEqual(
        expect.arrayContaining(['zimmerzahl', 'flaecheInnen', 'flaecheAussen', 'alpha']));
    }
  });

  it('bricht bei z_j <= -1 ab und kappt nicht — S-06, Modellgrenze', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Erste Einheit mit relativer Anpassung -1 (Anpassungssumme auf der Modellgrenze)',
      schritte: 'Stufe 2 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler ANPASSUNG_UNZULAESSIG mit art "modellgrenze" und zSumme -1; kein Kappen',
    });
    const r = berechneVerkaufssumme(pipelineEingang({ anpassungenErsteEinheit: [
      { faktor: -1, begruendung: 'Vollstaendiger Abschlag', erfassungsform: 'relativ' }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('ANPASSUNG_UNZULAESSIG');
      expect(r.fehler.parameter).toMatchObject({ art: 'modellgrenze', zSumme: -1 });
    }
  });

  it('bricht bei z_j ausserhalb der konfigurierten Grenzen ab — S-06, Konfigurationsgrenze', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Erste Einheit mit Anpassung 0.4 ausserhalb der konfigurierten Grenzen [-0.25, 0.25]',
      schritte: 'Stufe 2 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler mit art "konfigurationsgrenze", den Grenzen und der beanstandeten Anpassung samt Begründung',
    });
    const r = berechneVerkaufssumme(pipelineEingang({ anpassungenErsteEinheit: [
      { faktor: 0.4, begruendung: 'Aussichtslage mit Seeblick', erfassungsform: 'relativ' }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.parameter).toMatchObject(
        { art: 'konfigurationsgrenze', min: -0.25, max: 0.25 });
      expect(r.fehler.parameter['anpassungen']).toEqual(['0.4|Aussichtslage mit Seeblick']);
    }
  });

  it('bildet A_t_ref und A_j mit demselben alpha (Abnahmekriterium 9)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Eingang mit alpha 0.25 und 12 m2 Aussenfläche je Einheit und Referenz',
      schritte: 'Stufe 2 ausführen und Referenzfläche, gewichtete Fläche und Preis vergleichen',
      erwartung: 'Beide Flächen sind 92.5 + 0.25 * 12; der Preis bleibt P_ref',
      invariante: 'I-05',
    });
    const r = berechneVerkaufssumme(pipelineEingang({ alpha: 0.25, aussenflaeche: 12 }));
    if (r.ok) {
      expect(r.wert.alpha).toBe(0.25);
      expect(r.wert.typAbleitungen[0]!.referenzflaeche).toBeCloseTo(92.5 + 0.25 * 12, 12);
      expect(r.wert.positionen[0]!.gewichteteFlaeche).toBeCloseTo(92.5 + 0.25 * 12, 12);
      expect(r.wert.positionen[0]!.preis).toBe(85_000_000); // I-05 haelt auch mit Aussenflaeche
    }
  });

  it('gibt die Positionen nach Wohnungsnummer sortiert aus (Spec 03 §9.3)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Standard-Eingang mit vier Einheiten',
      schritte: 'Stufe 2 ausführen und die Wohnungsnummern der Positionen auslesen',
      erwartung: 'Die Positionen stehen aufsteigend nach Wohnungsnummer sortiert',
    });
    const r = berechneVerkaufssumme(pipelineEingang());
    if (r.ok) {
      const n = r.wert.positionen.map((p) => p.wohnungsnummer);
      expect(n).toEqual([...n].sort());
    }
  });
});
