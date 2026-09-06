/**
 * Keine Formel. Totale Abbildung der neun Abruf-Fehlertypen auf `ProviderFehler`
 * (E-02).
 */
import type { FehlerDiagnose, ProviderFehler } from '@offert/core';
import type { AdapterFehler, AdapterFehlerArt } from '../client/fehler.js';
import { MELDUNGEN } from './meldungen.js';

// Vollstaendige Abbildung; `KonfigurationsFehler` fehlt bewusst, da er nur bei der
// Initialisierung auftritt, nie bei einem Abruf.
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

// NFA-11: ausschliesslich `ProviderFehler` nach aussen. AK-13: erschoepfende
// Fallunterscheidung ohne `default` faellt zur Uebersetzungszeit auf, nicht zur Laufzeit.
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
      // exactOptionalPropertyTypes: bedingter Aufbau statt Zuweisung von undefined.
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
      // E4: eigener Grundcode, gleiche Zielvariante wie ContractViolation.
      return { art: 'antwort_ungueltig', detail: MELDUNGEN.StaleValuationError, diagnose };
    default: {
      const erschoepfend: never = fehler.art;
      throw new Error(`Unbehandelte Fehlerart in der Uebersetzung: ${String(erschoepfend)}`);
    }
  }
}
