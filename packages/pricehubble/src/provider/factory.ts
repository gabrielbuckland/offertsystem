/**
 * Keine Formel. Auswahl ueber Dependency Injection und Konfiguration (US-14, E-12).
 *
 *   mock (Vorgabe) — Interface-Ebene; ein frisch geklontes Repository laeuft ohne
 *                    Zugangsdaten gruen durch
 *   fixture        — reserviert fuer den Betrieb gegen aufgezeichnete Antworten;
 *                    derzeit baugleich mit `pricehubble` (echter Adapter, echtes
 *                    fetch), da noch keine Aufzeichnungen existieren und der
 *                    MSW-Ersatz nur in der Testumgebung laeuft
 *   pricehubble    — echter Adapter gegen die reale API
 *
 * Ein unbekannter Wert ist ein KonfigurationsFehler, kein stiller Rueckfall.
 * Der Wechsel zwischen den drei Werten erfordert null geaenderte Codedateien (AK-17).
 *
 * `konfiguration` wird UEBERGEBEN, nicht geladen (PE-17): Der `api`-Block gehoert nicht
 * zum Kerntyp `Konfiguration`. `apps/web/src/server` entnimmt ihn der von
 * `parseKonfiguration` mitgegebenen Rohkonfiguration und reicht ihn hier hinein. Damit
 * kennt weder der Kern den `api`-Block noch dieses Paket den Dateizugriff.
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
import { TokenVerwaltung } from '../client/token-verwaltung.js';
import { Warteschlange } from '../client/warteschlange.js';
import { systemUhr } from '../client/uhr.js';
import { jitterStromAusLaufSeed } from '../client/zufall.js';
import { MockValuationProvider } from './mock-valuation-provider.js';
import { PriceHubbleAdapter } from './pricehubble-adapter.js';

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
      zugangsdaten: {
        benutzername: env.PH_USERNAME ?? '',
        passwort: env.PH_PASSWORD ?? '',
      },
    }),
    uhr: systemUhr,
    protokoll: stdoutProtokoll,
    warteschlange: new Warteschlange(),
  });
}
