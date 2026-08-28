import { describe, expect, it } from 'vitest';
import { bereiteEingabeAuf } from '../../src/pipeline/stufe1-eingabe.js';
import { eingangsArgumente } from '../helper/projekt.js';
import { dokumentiere } from '../helper/dokumentiere.js';
import { lagescoreName, wohnungstypId } from '../../src/domain/ids.js';
import { score } from '../../src/domain/geld.js';

describe('Stufe 1 — bereiteEingabeAuf (Spec 03 §4.1)', () => {
  it('schlüsselt die Bewertungsliste in eine Map über WohnungstypId um', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Eingangsargumente mit einer Referenzbewertung für Wohnungstyp T1',
      schritte: 'bereiteEingabeAuf auf die Standard-Eingangsargumente anwenden',
      erwartung: 'Ergebnis ok; die Bewertungs-Map liefert unter T1 den Marktwert 85 000 000 Rappen',
    });
    const r = bereiteEingabeAuf(eingangsArgumente());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert.bewertungen.get(wohnungstypId('T1'))?.marktwert).toBe(85_000_000);
  });

  it('beschafft alle nicht abgeleiteten Rohwerte und vertagt die abgeleiteten (E-06)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Standardkonfiguration mit zwei direkten und zwei abgeleiteten Faktorquellen',
      schritte: 'Stufe 1 ausführen und Rohfaktoren sowie offene Faktoren auslesen',
      erwartung: 'rohfaktoren enthält innenausbau_qualitaet und lage_gesamt; offeneFaktoren enthält preissegment und projektumfang',
    });
    const r = bereiteEingabeAuf(eingangsArgumente());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect([...r.wert.rohfaktoren.keys()].sort())
        .toEqual(['innenausbau_qualitaet', 'lage_gesamt']);
      expect([...r.wert.offeneFaktoren].sort()).toEqual(['preissegment', 'projektumfang']);
    }
  });

  it('bricht bei fehlender Referenzbewertung ab — S-03, US-05, I-24', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Eingangsargumente ohne Referenzbewertungen (leere Liste)',
      schritte: 'Stufe 1 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler REFERENZBEWERTUNG_FEHLT in Stufe 1 mit Zimmerzahl, WohnungstypId, Wohnungsnummern und vollstaendig-Flag',
      invariante: 'I-24',
    });
    const r = bereiteEingabeAuf(eingangsArgumente({ bewertungen: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('REFERENZBEWERTUNG_FEHLT');
      expect(r.fehler.stufe).toBe(1);
      expect(r.fehler.parameter).toMatchObject({ zimmerzahl: 3.5, wohnungstypId: 'T1' });
      expect(r.fehler.parameter['wohnungsnummern']).toEqual(['A-01', 'A-02', 'A-03', 'A-04']);
      expect(r.fehler.parameter['vollstaendig']).toBe('false');
    }
  });

  it('bricht bei unauflösbarer Faktorquelle ab — S-02, phase "quelle"', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Lagescore-Bündel ohne Werte, obwohl die Konfiguration einen Lagescore-Faktor verlangt',
      schritte: 'Stufe 1 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler FAKTOR_FEHLT mit Parameter phase "quelle"',
    });
    const args = eingangsArgumente({
      lagescores: { werte: new Map(), meta: new Map(),
        abrufdatum: '2026-08-16', anbieter: 'mock' },
    });
    const r = bereiteEingabeAuf(args);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('FAKTOR_FEHLT');
      expect(r.fehler.parameter['phase']).toBe('quelle');
    }
  });

  it('verwirft einen gelieferten Rohwert ohne Konfigurationseintrag, ohne Fehler (S-02 Gegenrichtung)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Lagescore-Bündel mit dem zusätzlichen, nicht konfigurierten Score noise',
      schritte: 'Stufe 1 ausführen und die verworfenen Rohwerte auslesen',
      erwartung: 'Ergebnis ok; verworfeneRohwerte enthält lagescore:noise',
    });
    const args = eingangsArgumente({
      lagescores: {
        werte: new Map([[lagescoreName('location'), score(0.8)], [lagescoreName('noise'), score(0.4)]]),
        meta: new Map(), abrufdatum: '2026-08-16', anbieter: 'mock',
      },
    });
    const r = bereiteEingabeAuf(args);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert.verworfeneRohwerte).toContain('lagescore:noise');
  });

  it('rechnet nicht — der Eingang trägt keine Preisgrösse', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Standard-Eingangsargumente',
      schritte: 'Stufe 1 ausführen und die Felder des Ergebnisses prüfen',
      erwartung: 'Der Pipeline-Eingang trägt kein Feld verkaufssumme',
    });
    const r = bereiteEingabeAuf(eingangsArgumente());
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.wert)).not.toContain('verkaufssumme');
  });

  it('ist deterministisch: die Rohfaktoren stehen aufsteigend nach FaktorId (I-14)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Standard-Eingangsargumente',
      schritte: 'Stufe 1 ausführen und die Schlüssel der Rohfaktoren auslesen',
      erwartung: 'Die Schlüssel stehen aufsteigend sortiert nach FaktorId',
      invariante: 'I-14',
    });
    const r = bereiteEingabeAuf(eingangsArgumente());
    if (r.ok) {
      const keys = [...r.wert.rohfaktoren.keys()];
      expect(keys).toEqual([...keys].sort());
    }
  });

  it('reicht den Zeitstempel unverändert durch und liest keine Uhr (I-14, E-29)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Eingangsargumente mit festem Zeitstempel 2026-08-16T10:00:00.000Z',
      schritte: 'Stufe 1 ausführen und den Zeitstempel des Ergebnisses lesen',
      erwartung: 'Der Zeitstempel steht unverändert im Ergebnis',
      invariante: 'I-14',
    });
    const r = bereiteEingabeAuf(eingangsArgumente({ zeitstempel: '2026-08-16T10:00:00.000Z' }));
    if (r.ok) expect(r.wert.zeitstempel).toBe('2026-08-16T10:00:00.000Z');
  });

  it('meldet bei unvollständigem Bündel dennoch S-03 und kein Ergebnis (US-15, I-24)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Eingangsargumente ohne Bewertungen und mit vollstaendig=false',
      schritte: 'Stufe 1 ausführen und den Fehler inspizieren',
      erwartung: 'Fehler mit Parameter vollstaendig "false"; es entsteht kein Ergebnis',
      invariante: 'I-24',
    });
    const r = bereiteEingabeAuf(eingangsArgumente({ bewertungen: [], vollstaendig: false }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler.parameter['vollstaendig']).toBe('false');
  });
});
