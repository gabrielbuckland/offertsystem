import { describe, expect, it } from 'vitest';
import { bereiteEingabeAuf } from '../../src/pipeline/stufe1-eingabe.js';
import { eingangsArgumente } from '../helper/projekt.js';
import { lagescoreName, wohnungstypId } from '../../src/domain/ids.js';
import { score } from '../../src/domain/geld.js';

describe('Stufe 1 — bereiteEingabeAuf (Spec 03 §4.1)', () => {
  it('schluesselt die Bewertungsliste in eine Map ueber WohnungstypId um', () => {
    const r = bereiteEingabeAuf(eingangsArgumente());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert.bewertungen.get(wohnungstypId('T1'))?.marktwert).toBe(85_000_000);
  });

  it('beschafft alle nicht abgeleiteten Rohwerte und vertagt die abgeleiteten (E-06)', () => {
    const r = bereiteEingabeAuf(eingangsArgumente());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect([...r.wert.rohfaktoren.keys()].sort())
        .toEqual(['innenausbau_qualitaet', 'lage_gesamt']);
      expect([...r.wert.offeneFaktoren].sort()).toEqual(['preissegment', 'projektumfang']);
    }
  });

  it('bricht bei fehlender Referenzbewertung ab — S-03, US-05, I-24', () => {
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

  it('bricht bei unaufloesbarer Faktorquelle ab — S-02, phase "quelle"', () => {
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

  it('verwirft einen gelieferten Rohwert ohne Konfigurationseintrag, ohne Fehler (S-02 Gegenrichtung)', () => {
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

  it('rechnet nicht — der Eingang traegt keine Preisgroesse', () => {
    const r = bereiteEingabeAuf(eingangsArgumente());
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.wert)).not.toContain('verkaufssumme');
  });

  it('ist deterministisch: die Rohfaktoren stehen aufsteigend nach FaktorId (I-14)', () => {
    const r = bereiteEingabeAuf(eingangsArgumente());
    if (r.ok) {
      const keys = [...r.wert.rohfaktoren.keys()];
      expect(keys).toEqual([...keys].sort());
    }
  });

  it('reicht den Zeitstempel unveraendert durch und liest keine Uhr (I-14, E-29)', () => {
    const r = bereiteEingabeAuf(eingangsArgumente({ zeitstempel: '2026-08-16T10:00:00.000Z' }));
    if (r.ok) expect(r.wert.zeitstempel).toBe('2026-08-16T10:00:00.000Z');
  });

  it('meldet bei unvollstaendigem Buendel dennoch S-03 und kein Ergebnis (US-15, I-24)', () => {
    const r = bereiteEingabeAuf(eingangsArgumente({ bewertungen: [], vollstaendig: false }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler.parameter['vollstaendig']).toBe('false');
  });
});
