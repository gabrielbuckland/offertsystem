import type { ApiKonfiguration } from '../src/config/api-konfiguration.js';

// Im Produktivpfad stammen diese Werte aus `config/company-defaults.json`.
export function testKonfiguration(
  ueberschreibungen: Partial<ApiKonfiguration> = {},
): ApiKonfiguration {
  return {
    baseUrl: 'https://api.pricehubble.com',
    endpunkte: {
      login: '/auth/login/credentials',
      dossierGet: '/api/v1/dossiers/{dossierId}',
      dossierUpdate: '/api/v1/dossiers/{dossierId}',
      dossierValuation: '/api/v1/dossiers/{dossierId}/valuation',
      locationScores: '/api/v1/location/scores',
    },
    timeoutMs: 10_000,
    timeoutValuationMs: 20_000,
    gesamtbudgetMs: 45_000,
    retry: {
      maxVersuche: 3,
      startBackoffMs: 500,
      backoffFaktor: 2,
      maxBackoffMs: 8_000,
      jitter: 'voll',
      retryAfterBeachten: true,
      retryAfterMaxSekunden: 60,
      retryStatuscodes: [429, 500, 502, 503, 504],
    },
    tokenGueltigkeitMin: 720,
    tokenSicherheitsmargeMin: 30,
    ...ueberschreibungen,
  };
}
