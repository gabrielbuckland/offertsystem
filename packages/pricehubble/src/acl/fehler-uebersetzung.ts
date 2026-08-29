/**
 * Keine Formel. Totale Abbildung der neun Abruf-Fehlertypen auf `ProviderFehler`
 * (Spec 04 §6.5.2, E-02).
 */
import type { FehlerDiagnose, ProviderFehler } from '@offert/core';
import type { AdapterFehler, AdapterFehlerArt } from '../client/fehler.js';
import { MELDUNGEN } from './meldungen.js';

/**
 * Verbindliche und VOLLSTAENDIGE Abbildung. Sie ist die Bedingung dafuer, dass die
 * Zusage aus Spec 03 einloesbar ist, eine unbehandelte `ProviderFehler`-Variante sei
 * ein Uebersetzungsfehler.
 *
 * `KonfigurationsFehler` erscheint nicht: Er tritt bei der Initialisierung auf,
 * nie bei einem Abruf (§6.5.3).
 */
export const FEHLER_ABBILDUNG: Readonly<Record<AdapterFehlerArt, ProviderFehler['art']>> = {
  AuthError: 'authentifizierung',
  NetworkError: 'nicht_erreichbar',
  TimeoutError: 'zeitueberschreitung',
  RateLimitError: 'kontingent',
  ClientError: 'anfrage_abgelehnt',
  NotFoundError: 'objekt_unbekannt',
  ServerError: 'dienst_gestoert',
  ContractViolation: 'antwort_ungueltig',
  StaleValuationError: 'antwort_ungueltig',
};

function diagnoseVon(fehler: AdapterFehler): FehlerDiagnose {
  return {
    endpoint: fehler.endpunkt,
    ...(fehler.httpStatus === undefined ? {} : { httpStatus: fehler.httpStatus }),
    ...(fehler.phRequestId === undefined ? {} : { phRequestId: fehler.phRequestId }),
    versuche: fehler.versuche,
    dauerMs: fehler.dauerMs,
  };
}

/**
 * Der ACL gibt ausschliesslich `ProviderFehler` nach aussen; ein roher fetch-Fehler,
 * ein Zod-Fehler oder ein HTTP-Statuscode erreicht die aufrufende Schicht nie (NFA-11).
 *
 * Die Fallunterscheidung ist erschoepfend und ohne `default`: Eine neue Variante
 * bricht die Uebersetzung zur Uebersetzungszeit, nicht zur Laufzeit (AK-13).
 */
export function uebersetzeFehler(fehler: AdapterFehler): ProviderFehler {
  const diagnose = diagnoseVon(fehler);
  switch (fehler.art) {
    case 'AuthError':
      return { art: 'authentifizierung', detail: MELDUNGEN.AuthError, diagnose };
    case 'NetworkError':
      return { art: 'nicht_erreichbar', detail: MELDUNGEN.NetworkError, diagnose };
    case 'TimeoutError':
      return { art: 'zeitueberschreitung', detail: MELDUNGEN.TimeoutError, diagnose };
    case 'RateLimitError':
      return {
        art: 'kontingent',
        ...(fehler.wiederholbarNachSek === undefined
          ? {}
          : { wiederholbarNach: fehler.wiederholbarNachSek }),
        diagnose,
      };
    case 'ClientError':
      // `exactOptionalPropertyTypes: true` unterscheidet «Eigenschaft fehlt» von
      // «Eigenschaft ist undefined». Bei `feld?: string` waere `feld: fehler.feld`
      // deshalb ein Typfehler, sobald `fehler.feld` undefined sein kann. Die
      // Eigenschaft wird daher bedingt aufgebaut statt mit undefined belegt.
      return {
        art: 'anfrage_abgelehnt',
        detail: MELDUNGEN.ClientError,
        ...(fehler.feld === undefined ? {} : { feld: fehler.feld }),
        diagnose,
      };
    case 'NotFoundError':
      return { art: 'objekt_unbekannt', detail: MELDUNGEN.NotFoundError, diagnose };
    case 'ServerError':
      return { art: 'dienst_gestoert', detail: MELDUNGEN.ServerError, diagnose };
    case 'ContractViolation':
      return { art: 'antwort_ungueltig', detail: MELDUNGEN.ContractViolation, diagnose };
    case 'StaleValuationError':
      // Eigener Grundcode innerhalb derselben Zielvariante: Die Zusicherung
      // `isValuationStale === false` nach E4 ist Teil des Antwortvertrags.
      return { art: 'antwort_ungueltig', detail: MELDUNGEN.StaleValuationError, diagnose };
    default: {
      const erschoepfend: never = fehler.art;
      throw new Error(`Unbehandelte Fehlerart in der Uebersetzung: ${String(erschoepfend)}`);
    }
  }
}
