import { describe, expect, it } from 'vitest';
import type { ApiKonfiguration } from '../src/config/api-konfiguration.js';
import {
  pruefeApiKonfiguration,
  pruefeUmgebung,
} from '../src/config/api-konfiguration.js';
import { KonfigurationsFehler } from '../src/config/konfigurations-fehler.js';
import { testKonfiguration } from './test-konfiguration.js';

describe('Initialisierungspruefung (Spec 04 §2 Regel 2, §6.2)', () => {
  it('akzeptiert eine vollstaendige Konfiguration', () => {
    expect(() => pruefeApiKonfiguration(testKonfiguration())).not.toThrow();
  });

  it('weist maxVersuche < 1 als KonfigurationsFehler zurueck', () => {
    const k = testKonfiguration();
    const kaputt = { ...k, retry: { ...k.retry, maxVersuche: 0 } };
    expect(() => pruefeApiKonfiguration(kaputt)).toThrow(KonfigurationsFehler);
  });

  it('weist ein nichtpositives Zeitlimit zurueck', () => {
    const kaputt = { ...testKonfiguration(), timeoutMs: 0 };
    expect(() => pruefeApiKonfiguration(kaputt)).toThrow(/timeoutMs/);
  });

  it('weist backoffFaktor < 1 zurueck', () => {
    const k = testKonfiguration();
    const kaputt = { ...k, retry: { ...k.retry, backoffFaktor: 0.5 } };
    expect(() => pruefeApiKonfiguration(kaputt)).toThrow(/backoffFaktor/);
  });

  it.each<[string, (k: ApiKonfiguration) => ApiKonfiguration, RegExp]>([
    ['eine leere baseUrl', (k) => ({ ...k, baseUrl: '   ' }), /baseUrl/],
    ['einen leeren Endpunkt', (k) => ({
      ...k, endpunkte: { ...k.endpunkte, login: '' },
    }), /endpunkte\.login/],
    ['ein nichtpositives gesamtbudgetMs', (k) => ({ ...k, gesamtbudgetMs: 0 }), /gesamtbudgetMs/],
    ['ein nichtpositives tokenGueltigkeitMin', (k) => ({ ...k, tokenGueltigkeitMin: 0 }),
      /tokenGueltigkeitMin/],
    ['ein nichtpositives startBackoffMs', (k) => ({
      ...k, retry: { ...k.retry, startBackoffMs: 0 },
    }), /startBackoffMs/],
    ['ein nichtpositives maxBackoffMs', (k) => ({
      ...k, retry: { ...k.retry, maxBackoffMs: 0 },
    }), /maxBackoffMs/],
    ['ein nichtpositives retryAfterMaxSekunden', (k) => ({
      ...k, retry: { ...k.retry, retryAfterMaxSekunden: 0 },
    }), /retryAfterMaxSekunden/],
    ['ein tokenSicherheitsmargeMin >= tokenGueltigkeitMin', (k) => ({
      ...k, tokenSicherheitsmargeMin: k.tokenGueltigkeitMin,
    }), /tokenSicherheitsmargeMin/],
    ['einen ungueltigen jitter-Wert', (k) => ({
      ...k, retry: { ...k.retry, jitter: 'irgendwas' as ApiKonfiguration['retry']['jitter'] },
    }), /jitter/],
    ['leere retryStatuscodes', (k) => ({
      ...k, retry: { ...k.retry, retryStatuscodes: [] },
    }), /retryStatuscodes/],
  ])('weist %s zurueck', (_name, aendere, muster) => {
    const kaputt = aendere(testKonfiguration());
    expect(() => pruefeApiKonfiguration(kaputt)).toThrow(muster);
  });

  it('verlangt bei VALUATION_PROVIDER=pricehubble die drei Zugangsvariablen', () => {
    expect(() =>
      pruefeUmgebung({
        VALUATION_PROVIDER: 'pricehubble',
        PH_USERNAME: 'a',
        PH_PASSWORD: 'b',
      }),
    ).toThrow(/PH_DOSSIER_ID/);
  });

  it('laesst mit PH_ACCESS_TOKEN die Zugangsdaten entfallen, nicht aber das Dossier (E-31)', () => {
    expect(() =>
      pruefeUmgebung({
        VALUATION_PROVIDER: 'pricehubble',
        PH_ACCESS_TOKEN: 't-manuell',
        PH_DOSSIER_ID: '4711',
      }),
    ).not.toThrow();
    expect(() =>
      pruefeUmgebung({ VALUATION_PROVIDER: 'pricehubble', PH_ACCESS_TOKEN: 't-manuell' }),
    ).toThrow(/PH_DOSSIER_ID/);
  });

  it('verlangt bei VALUATION_PROVIDER=mock keine Zugangsvariablen', () => {
    expect(() => pruefeUmgebung({ VALUATION_PROVIDER: 'mock' })).not.toThrow();
  });

  it('behandelt einen unbekannten Provider-Wert als KonfigurationsFehler', () => {
    expect(() => pruefeUmgebung({ VALUATION_PROVIDER: 'echt' })).toThrow(
      KonfigurationsFehler,
    );
  });

  it('nennt in der Fehlermeldung niemals das Passwort', () => {
    try {
      pruefeUmgebung({ VALUATION_PROVIDER: 'pricehubble', PH_PASSWORD: 'geheim' });
    } catch (fehler) {
      expect(String(fehler)).not.toContain('geheim');
    }
  });
});
