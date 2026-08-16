import { describe, expect, it } from 'vitest';
import { beschafferFuer } from '../../src/pipeline/beschaffer.js';
import { faktorId, lagescoreName } from '../../src/domain/ids.js';
import { gewicht, score } from '../../src/domain/geld.js';
import type { FaktorParameter } from '../../src/config/typen.js';
import { lagescoresFixture } from '../helper/projekt.js';

const parameter = (u: Partial<FaktorParameter> = {}): FaktorParameter => ({
  grenzeMin: 0, grenzeMax: 1, gewicht: gewicht(0.25), strategie: 'min-max',
  quelle: 'lagescore', quellSchluessel: 'location', bezeichnung: 'Lage gesamt', ...u,
});

const kontext = {
  lagescores: lagescoresFixture(new Map([[lagescoreName('location'), score(0.8)]])),
  vermarkterFaktoren: { werte: new Map([[faktorId('innenausbau_qualitaet'), 3]]) },
};

describe('Generischer Quellenaufloeser (E-05)', () => {
  it('beschafft einen Lagescore ueber quellSchluessel, nicht ueber die FaktorId (E-08)', () => {
    const r = beschafferFuer('lagescore').beschaffe(
      'location', kontext, parameter(), faktorId('lage_gesamt'), 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert).toBe(0.8);
  });

  it('beschafft einen manuell erfassten Rohwert', () => {
    const r = beschafferFuer('manuell').beschaffe(
      'innenausbau_qualitaet', kontext,
      parameter({ quelle: 'manuell', quellSchluessel: 'innenausbau_qualitaet' }),
      faktorId('innenausbau_qualitaet'), 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert).toBe(3);
  });

  it('meldet fuer abgeleitete Faktoren in Stufe 1 "spaeter" (E-06)', () => {
    const r = beschafferFuer('abgeleitet').beschaffe(
      'einheitenzahl', kontext,
      parameter({ quelle: 'abgeleitet', quellSchluessel: 'einheitenzahl' }),
      faktorId('projektumfang'), 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert).toBe('spaeter');
  });

  it('loest abgeleitete Faktoren im Zwischenschritt auf', () => {
    const r = beschafferFuer('abgeleitet').beschaffe(
      'einheitenzahl', { ...kontext, ableitungen: new Map([['einheitenzahl' as const, 24]]) },
      parameter({ quelle: 'abgeleitet', quellSchluessel: 'einheitenzahl' }),
      faktorId('projektumfang'), 3);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert).toBe(24);
  });

  it('meldet S-02 mit phase "quelle" bei unaufloesbarem Lagescore-Namen', () => {
    const r = beschafferFuer('lagescore').beschaffe(
      'locatoin', kontext, parameter({ quellSchluessel: 'locatoin' }), faktorId('lage_gesamt'), 1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('FAKTOR_FEHLT');
      expect(r.fehler.stufe).toBe(1);
      expect(r.fehler.parameter).toMatchObject({
        phase: 'quelle', quelle: 'lagescore', quellSchluessel: 'locatoin',
        faktorId: 'lage_gesamt', bezeichnung: 'Lage gesamt',
      });
    }
  });

  it('meldet S-02 mit phase "rohwert" bei unbekannter Ableitung (Spec 06 §2.4)', () => {
    const r = beschafferFuer('abgeleitet').beschaffe(
      'unbekannteKennzahl', { ...kontext, ableitungen: new Map([['einheitenzahl' as const, 24]]) },
      parameter({ quelle: 'abgeleitet', quellSchluessel: 'unbekannteKennzahl' }),
      faktorId('risikoindex'), 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler.parameter['phase']).toBe('rohwert');
  });

  it('fuehrt genau drei Quellen; die Menge ist geschlossen', () => {
    for (const q of ['lagescore', 'manuell', 'abgeleitet'] as const) {
      expect(beschafferFuer(q).quelle).toBe(q);
    }
  });
});
