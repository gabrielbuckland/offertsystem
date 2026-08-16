/**
 * Gemeinsame Testhilfen der Adaptertests.
 *
 * Bewusst eine eigene Datei statt eines Exports aus einer `.test.ts`: Vitest fuehrt
 * Testdateien in getrennten Prozessen aus, und ein Import quer zwischen ihnen liesse
 * die Hooks der importierten Datei ein zweites Mal registrieren.
 */
import type { Adresse, BewertungsAnfrage, WohnungstypId } from '@offert/core';
import { PriceHubbleAdapter } from '../src/provider/priceHubbleAdapter.js';
import { HttpClient } from '../src/client/httpClient.js';
import { TokenVerwaltung } from '../src/client/tokenVerwaltung.js';
import { Warteschlange } from '../src/client/warteschlange.js';
import { sammelndesProtokoll } from '../src/client/protokoll.js';
import { systemUhr } from '../src/client/uhr.js';
import { erzeugeZufallsquelle } from '../src/client/zufall.js';
import { TEST_DOSSIER_ID } from './fixtures.js';
import { testKonfiguration } from './testKonfiguration.js';

export function baueAdapter(konfiguration = testKonfiguration()) {
  const protokoll = sammelndesProtokoll();
  const client = new HttpClient({
    konfiguration,
    uhr: systemUhr,
    zufall: erzeugeZufallsquelle(4242),
    protokoll,
    fetchImpl: globalThis.fetch,
  });
  const adapter = new PriceHubbleAdapter({
    konfiguration,
    dossierId: TEST_DOSSIER_ID,
    client,
    tokenVerwaltung: new TokenVerwaltung({
      client,
      konfiguration,
      uhr: systemUhr,
      zugangsdaten: { benutzername: 'u', passwort: 'p' },
    }),
    uhr: systemUhr,
    protokoll,
    warteschlange: new Warteschlange(),
  });
  return { adapter, protokoll };
}

export const adresse: Adresse = {
  strasse: 'Musterstrasse',
  hausnummer: '1',
  plz: '6000',
  ort: 'Luzern',
};

export function anfrage(nummer: number): BewertungsAnfrage {
  return {
    adresse,
    wohnungstypId: `t-${nummer}` as WohnungstypId,
    zimmerzahl: 2.5 + nummer,
    parametrisierung: {
      flaecheInnen: (60 + nummer * 10) as BewertungsAnfrage['parametrisierung']['flaecheInnen'],
      flaecheAussen: 10 as BewertungsAnfrage['parametrisierung']['flaecheAussen'],
      stockwerk: nummer,
      energielabel: 'minergie',
      zustandsbewertungen: { bathrooms: 'new_or_recently_renovated' },
      qualitaetsbewertungen: { bathrooms: 'high_quality' },
      anzahlBadezimmer: 1,
      lift: true,
      baujahr: 2026,
      heizungsart: 'heat_pump_air',
    },
  };
}
