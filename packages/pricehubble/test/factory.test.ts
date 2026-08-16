import type { LagescoreName, WohnungstypId } from '@offert/core';
import { describe, expect, it } from 'vitest';
import { KonfigurationsFehler } from '../src/config/konfigurationsFehler.js';
import { MockValuationProvider } from '../src/provider/mockValuationProvider.js';
import { PriceHubbleAdapter } from '../src/provider/priceHubbleAdapter.js';
import { createValuationProvider } from '../src/provider/factory.js';
import { anfrage, adresse } from './adapterHilfen.js';
import { testKonfiguration } from './testKonfiguration.js';

describe('Provider-Auswahl ohne Codeaenderung (US-14, E-12, AK-17)', () => {
  it('waehlt ohne gesetzte Variable den Interface-Mock', () => {
    const provider = createValuationProvider({}, testKonfiguration());
    expect(provider).toBeInstanceOf(MockValuationProvider);
  });

  it('waehlt bei fixture den echten Adapter (Schemavalidierung laeuft mit)', () => {
    const provider = createValuationProvider(
      { VALUATION_PROVIDER: 'fixture', PH_DOSSIER_ID: '00000000-0000-4000-8000-000000000001' },
      testKonfiguration(),
    );
    expect(provider).toBeInstanceOf(PriceHubbleAdapter);
  });

  it('waehlt bei pricehubble den echten Adapter', () => {
    const provider = createValuationProvider(
      {
        VALUATION_PROVIDER: 'pricehubble',
        PH_USERNAME: 'u',
        PH_PASSWORD: 'p',
        PH_DOSSIER_ID: '00000000-0000-4000-8000-000000000001',
      },
      testKonfiguration(),
    );
    expect(provider).toBeInstanceOf(PriceHubbleAdapter);
  });

  it('scheitert bei pricehubble ohne Zugangsdaten schon bei der Initialisierung', () => {
    expect(() =>
      createValuationProvider({ VALUATION_PROVIDER: 'pricehubble' }, testKonfiguration()),
    ).toThrow(KonfigurationsFehler);
  });

  it('faellt bei unbekanntem Wert nicht still auf die Vorgabe zurueck', () => {
    expect(() =>
      createValuationProvider({ VALUATION_PROVIDER: 'echt' }, testKonfiguration()),
    ).toThrow(KonfigurationsFehler);
  });
});

describe('MockValuationProvider (Mock-Ebene A, US-14)', () => {
  it('liefert deterministische Bewertungen ohne Netzwerk', async () => {
    const mock = new MockValuationProvider();
    const a = await mock.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    const b = await mock.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    expect(a).toEqual(b);
    expect(a.ok && a.wert.vollstaendig).toBe(true);
    expect(a.ok && a.wert.bewertungen.get('t-1' as WohnungstypId)?.anbieter).toBe('mock');
  });

  it('liefert neun Lagescores', async () => {
    const ergebnis = await new MockValuationProvider().holeLagescores(adresse);
    expect(ergebnis.ok && ergebnis.wert.werte.size).toBe(9);
    expect(ergebnis.ok && ergebnis.wert.werte.get('location' as LagescoreName)).toBe(0.82);
  });

  it('kann ein gekennzeichnetes Teilergebnis erzeugen (US-15)', async () => {
    const mock = new MockValuationProvider({ scheiternAbTyp: 't-2' as WohnungstypId });
    const ergebnis = await mock.bewerteWohnungstypen([anfrage(1), anfrage(2), anfrage(3)]);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.vollstaendig).toBe(false);
    expect(ergebnis.wert.bewertungen.size).toBe(1);
    expect(ergebnis.wert.fehler?.diagnose.versuche).toBeGreaterThan(0);
  });

  it('kann einen Portfehler erzeugen und fuellt dabei diagnose', async () => {
    const mock = new MockValuationProvider({ lagescoreFehler: 'zeitueberschreitung' });
    const ergebnis = await mock.holeLagescores(adresse);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.art).toBe('zeitueberschreitung');
    expect(ergebnis.fehler.diagnose).toMatchObject({ endpoint: 'locationScores' });
  });
});
