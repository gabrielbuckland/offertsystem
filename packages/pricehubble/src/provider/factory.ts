/**
 * Keine Formel. Auswahl ueber Dependency Injection und Konfiguration (US-14, E-12).
 * mock (Vorgabe) laeuft ohne Zugangsdaten; fixture nutzt den echten Adapter samt
 * Schemavalidierung, ersetzt aber das fetch durch die aufgezeichneten Antworten der
 * produktiven API (E-31, kein Netz). Unbekannter Wert = KonfigurationsFehler,
 * kein stiller Rueckfall (AK-17).
 *
 * `konfiguration` wird UEBERGEBEN, nicht geladen (PE-17): der `api`-Block gehoert nicht
 * zum Kerntyp `Konfiguration`, damit kennt weder der Kern den Block noch dieses Paket
 * den Dateizugriff.
 */
import type { ValuationProvider } from '@offert/core';
import {
  pruefeApiKonfiguration,
  pruefeUmgebung,
  type AdapterUmgebung,
  type ApiKonfiguration,
} from '../config/api-konfiguration.js';
import { HttpClient } from '../client/http-client.js';
import { stdoutProtokoll } from '../client/protokoll.js';
import { TokenVerwaltung, type Zugang } from '../client/token-verwaltung.js';
import { Warteschlange } from '../client/warteschlange.js';
import { systemUhr } from '../client/uhr.js';
import { jitterStromAusLaufSeed } from '../client/zufall.js';
import { TEST_UUID } from '../acl/anonymisierung.js';
import { erzeugeFixtureFetch, findeAufzeichnungsVerzeichnis } from './fixture-fetch.js';
import { MockValuationProvider } from './mock-valuation-provider.js';
import { PriceHubbleAdapter } from './pricehubble-adapter.js';

/** PH_ACCESS_TOKEN gewinnt; sonst der Login mit Zugangsdaten (E-31). */
function zugangAus(env: AdapterUmgebung): Zugang {
  const token = (env.PH_ACCESS_TOKEN ?? '').trim();
  if (token !== '') {
    return { art: 'token', token };
  }
  return {
    art: 'zugangsdaten',
    benutzername: env.PH_USERNAME ?? '',
    passwort: env.PH_PASSWORD ?? '',
  };
}

export interface FactoryOptionen {
  /** Lauf-Seed; der Jitter-Strom ist daraus als `seed XOR 1` abgeleitet (E-27). */
  readonly laufSeed?: number;
}

export function createValuationProvider(
  env: AdapterUmgebung,
  konfiguration: ApiKonfiguration,
  optionen: FactoryOptionen = {},
): ValuationProvider {
  const schalter = pruefeUmgebung(env);
  if (schalter === 'mock') {
    return new MockValuationProvider();
  }
  if (schalter === 'fixture') {
    const gepruefteKonfiguration = pruefeApiKonfiguration(konfiguration);
    const client = new HttpClient({
      konfiguration: gepruefteKonfiguration,
      uhr: systemUhr,
      zufall: jitterStromAusLaufSeed(optionen.laufSeed ?? 0),
      protokoll: stdoutProtokoll,
      fetchImpl: erzeugeFixtureFetch(
        gepruefteKonfiguration.endpunkte,
        findeAufzeichnungsVerzeichnis(),
      ),
    });
    return new PriceHubbleAdapter({
      konfiguration: gepruefteKonfiguration,
      dossierId: env.PH_DOSSIER_ID ?? TEST_UUID,
      client,
      tokenVerwaltung: new TokenVerwaltung({
        client,
        konfiguration: gepruefteKonfiguration,
        uhr: systemUhr,
        // Der Login laeuft durch den Fixture-Transport und damit durchs LoginResponseSchema.
        zugang: { art: 'zugangsdaten', benutzername: 'fixture', passwort: 'fixture' },
      }),
      uhr: systemUhr,
      protokoll: stdoutProtokoll,
      warteschlange: new Warteschlange(),
    });
  }
  const geprueft = pruefeApiKonfiguration({
    ...konfiguration,
    baseUrl: env.PH_BASE_URL ?? konfiguration.baseUrl,
  });
  const client = new HttpClient({
    konfiguration: geprueft,
    uhr: systemUhr,
    zufall: jitterStromAusLaufSeed(optionen.laufSeed ?? 0),
    protokoll: stdoutProtokoll,
    fetchImpl: globalThis.fetch,
  });
  return new PriceHubbleAdapter({
    konfiguration: geprueft,
    dossierId: env.PH_DOSSIER_ID ?? '',
    client,
    tokenVerwaltung: new TokenVerwaltung({
      client,
      konfiguration: geprueft,
      uhr: systemUhr,
      zugang: zugangAus(env),
    }),
    uhr: systemUhr,
    protokoll: stdoutProtokoll,
    warteschlange: new Warteschlange(),
  });
}
