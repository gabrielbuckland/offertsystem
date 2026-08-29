import type { ProviderFehler } from '@offert/core';
import { describe, expect, it } from 'vitest';
import { FEHLER_ABBILDUNG, uebersetzeFehler } from '../src/acl/fehler-uebersetzung.js';
import { ADAPTER_FEHLERARTEN, type AdapterFehler } from '../src/client/fehler.js';

function beispiel(teil: Partial<AdapterFehler>): AdapterFehler {
  return {
    art: 'ServerError',
    endpunkt: 'dossierValuation',
    versuche: 3,
    dauerMs: 1500,
    detail: 'Statuscode 503',
    ...teil,
  };
}

describe('Abbildungstabelle (Spec 04 §6.5.2, E-02, AK-13)', () => {
  it('ist total: jede der neun Abruf-Fehlerarten hat genau ein Ziel', () => {
    for (const art of ADAPTER_FEHLERARTEN) {
      expect(FEHLER_ABBILDUNG[art]).toBeDefined();
    }
    expect(Object.keys(FEHLER_ABBILDUNG)).toHaveLength(ADAPTER_FEHLERARTEN.length);
  });

  it('erreicht jede der acht ProviderFehler-Varianten mindestens einmal', () => {
    const erreicht = new Set(Object.values(FEHLER_ABBILDUNG));
    expect([...erreicht].sort()).toEqual(
      [
        'anfrage_abgelehnt',
        'authentifizierung',
        'dienst_gestoert',
        'kontingent',
        'nicht_erreichbar',
        'objekt_unbekannt',
        'zeitueberschreitung',
        'antwort_ungueltig',
      ].sort(),
    );
  });

  it.each([
    ['AuthError', 'authentifizierung'],
    ['NetworkError', 'nicht_erreichbar'],
    ['TimeoutError', 'zeitueberschreitung'],
    ['RateLimitError', 'kontingent'],
    ['ClientError', 'anfrage_abgelehnt'],
    ['NotFoundError', 'objekt_unbekannt'],
    ['ServerError', 'dienst_gestoert'],
    ['ContractViolation', 'antwort_ungueltig'],
    ['StaleValuationError', 'antwort_ungueltig'],
  ] as const)('bildet %s auf %s ab', (adapterArt, zielArt) => {
    const uebersetzt = uebersetzeFehler(beispiel({ art: adapterArt }));
    expect(uebersetzt.art).toBe(zielArt);
  });

  it('traegt in jeder Variante das vollstaendige Diagnoseobjekt', () => {
    const uebersetzt = uebersetzeFehler(
      beispiel({ httpStatus: 503, phRequestId: 'r-9', versuche: 3, dauerMs: 1500 }),
    );
    expect(uebersetzt.diagnose).toEqual({
      endpoint: 'dossierValuation',
      httpStatus: 503,
      phRequestId: 'r-9',
      versuche: 3,
      dauerMs: 1500,
    });
  });

  it('transportiert die Wartedauer bei kontingent', () => {
    const uebersetzt = uebersetzeFehler(
      beispiel({ art: 'RateLimitError', wiederholbarNachSek: 120 }),
    );
    expect(uebersetzt).toMatchObject({ art: 'kontingent', wiederholbarNach: 120 });
  });

  it('benennt bei anfrage_abgelehnt das beanstandete Feld', () => {
    const uebersetzt = uebersetzeFehler(
      beispiel({ art: 'ClientError', feld: 'property.livingArea' }),
    );
    expect(uebersetzt).toMatchObject({ art: 'anfrage_abgelehnt', feld: 'property.livingArea' });
  });

  it('reicht keinen Rohfehlertext des Anbieters durch (NFA-11)', () => {
    const uebersetzt = uebersetzeFehler(
      beispiel({ art: 'ServerError', detail: 'java.lang.NullPointerException at Foo.bar' }),
    ) as Extract<ProviderFehler, { art: 'dienst_gestoert' }>;
    expect(uebersetzt.detail).not.toContain('NullPointerException');
    expect(uebersetzt.detail).toContain('PriceHubble');
  });

  it('unterscheidet Schema- und Stale-Grundcode innerhalb von antwort_ungueltig', () => {
    const schema = uebersetzeFehler(beispiel({ art: 'ContractViolation' }));
    const stale = uebersetzeFehler(beispiel({ art: 'StaleValuationError' }));
    expect(schema.art).toBe('antwort_ungueltig');
    expect(stale.art).toBe('antwort_ungueltig');
    expect(schema).not.toEqual(stale);
  });
});
