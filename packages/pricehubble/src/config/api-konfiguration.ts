/**
 * Keine Formel. Typ und Initialisierungspruefung des `api`-Blocks (Spec 04 §2, §6.2).
 *
 * Der Block wird dem Adapter von `apps/web/src/server` uebergeben (PE-17, G-9); dieses
 * Paket laedt ihn nicht und sucht ihn nicht. Geprueft wird die Erwartung an das, was
 * uebergeben wurde — bewusst doppelt zu P1s Ladezeitpruefung, weil der Adapter auch
 * programmatisch aufgerufen werden kann.
 */
import { KonfigurationsFehler } from './konfigurations-fehler.js';

/** Endpunktschablonen; `{dossierId}` wird zur Laufzeit ersetzt (Spec 04 §1.1). */
export interface Endpunkte {
  readonly login: string;
  readonly dossierGet: string;
  readonly dossierUpdate: string;
  readonly dossierValuation: string;
  readonly locationScores: string;
}

export interface RetryKonfiguration {
  readonly maxVersuche: number;
  readonly startBackoffMs: number;
  readonly backoffFaktor: number;
  readonly maxBackoffMs: number;
  readonly jitter: 'voll' | 'keiner';
  readonly retryAfterBeachten: boolean;
  readonly retryAfterMaxSekunden: number;
  readonly retryStatuscodes: readonly number[];
}

/**
 * Schluesselnamen nach Spec 02 §1.2 (E-13, G-7). Der Adapter haelt keine eigene
 * Konstante; jeder Wert stammt aus `config.api.*`.
 */
export interface ApiKonfiguration {
  readonly baseUrl: string;
  readonly endpunkte: Endpunkte;
  readonly timeoutMs: number;
  readonly timeoutValuationMs: number;
  readonly gesamtbudgetMs: number;
  readonly retry: RetryKonfiguration;
  readonly tokenGueltigkeitMin: number;
  readonly tokenSicherheitsmargeMin: number;
}

export interface AdapterUmgebung {
  readonly VALUATION_PROVIDER?: string;
  readonly PH_BASE_URL?: string;
  readonly PH_USERNAME?: string;
  readonly PH_PASSWORD?: string;
  readonly PH_DOSSIER_ID?: string;
}

export type ProviderSchalter = 'mock' | 'fixture' | 'pricehubble';

function positiv(wert: number, schluessel: string): void {
  if (!Number.isFinite(wert) || wert <= 0) {
    throw new KonfigurationsFehler(schluessel, 'erwartet wird eine positive Zahl');
  }
}

export function pruefeApiKonfiguration(k: ApiKonfiguration): ApiKonfiguration {
  if (k.baseUrl.trim() === '') {
    throw new KonfigurationsFehler('api.baseUrl', 'darf nicht leer sein');
  }
  for (const [name, pfad] of Object.entries(k.endpunkte)) {
    if (typeof pfad !== 'string' || pfad.trim() === '') {
      throw new KonfigurationsFehler(`api.endpunkte.${name}`, 'darf nicht leer sein');
    }
  }
  positiv(k.timeoutMs, 'api.timeoutMs');
  positiv(k.timeoutValuationMs, 'api.timeoutValuationMs');
  positiv(k.gesamtbudgetMs, 'api.gesamtbudgetMs');
  positiv(k.tokenGueltigkeitMin, 'api.tokenGueltigkeitMin');
  positiv(k.retry.startBackoffMs, 'api.retry.startBackoffMs');
  positiv(k.retry.maxBackoffMs, 'api.retry.maxBackoffMs');
  positiv(k.retry.retryAfterMaxSekunden, 'api.retry.retryAfterMaxSekunden');
  if (!Number.isInteger(k.retry.maxVersuche) || k.retry.maxVersuche < 1) {
    throw new KonfigurationsFehler('api.retry.maxVersuche', 'erwartet wird eine Ganzzahl >= 1');
  }
  if (!(k.retry.backoffFaktor >= 1)) {
    throw new KonfigurationsFehler('api.retry.backoffFaktor', 'erwartet wird ein Wert >= 1');
  }
  if (k.tokenSicherheitsmargeMin < 0 || k.tokenSicherheitsmargeMin >= k.tokenGueltigkeitMin) {
    throw new KonfigurationsFehler(
      'api.tokenSicherheitsmargeMin',
      'erwartet wird ein Wert >= 0 und kleiner als api.tokenGueltigkeitMin',
    );
  }
  if (k.retry.jitter !== 'voll' && k.retry.jitter !== 'keiner') {
    throw new KonfigurationsFehler('api.retry.jitter', 'zulaessig sind "voll" und "keiner"');
  }
  if (k.retry.retryStatuscodes.length === 0) {
    throw new KonfigurationsFehler('api.retry.retryStatuscodes', 'darf nicht leer sein');
  }
  return k;
}

export function pruefeUmgebung(env: AdapterUmgebung): ProviderSchalter {
  const schalter = env.VALUATION_PROVIDER ?? 'mock';
  if (schalter !== 'mock' && schalter !== 'fixture' && schalter !== 'pricehubble') {
    throw new KonfigurationsFehler(
      'VALUATION_PROVIDER',
      'zulaessig sind "mock", "fixture" und "pricehubble"',
    );
  }
  if (schalter === 'pricehubble') {
    for (const name of ['PH_USERNAME', 'PH_PASSWORD', 'PH_DOSSIER_ID'] as const) {
      if ((env[name] ?? '').trim() === '') {
        throw new KonfigurationsFehler(name, 'ist bei VALUATION_PROVIDER=pricehubble Pflicht');
      }
    }
  }
  return schalter;
}
