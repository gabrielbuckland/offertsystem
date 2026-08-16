/**
 * Meilenstein M-FIX — Aufzeichnungspfad (E-31, Spec 04 §8.3).
 *
 * Laufzeit: `node --experimental-strip-types` (Node >= 22.6, PE-09). Kein `tsx`.
 *
 * EINZIGES Skript mit echtem API-Zugriff. Nie Teil von `verify` oder `test`.
 * Es verbraucht kontingentierte Abrufe, verlangt Zugangsdaten und veraendert
 * versioniertes Testmaterial; ein Testlauf, der Fixtures veraendert, waere zudem
 * nicht reproduzierbar.
 *
 * Einziger zulaessiger Weg, auf dem Dateien unter `fixtures/pricehubble/recorded/`
 * entstehen; von Hand abgelegte Dateien sind unzulaessig, weil ihre Herkunft dann
 * nicht belegt waere. Genau EIN Durchlauf je Endpunkt.
 *
 * Die Importe sind relativ, weil Node das Type-Stripping fuer `node_modules`
 * verweigert (PE-09, PE-11).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anonymisiere } from '../packages/pricehubble/src/acl/anonymisierung.js';
import { HttpClient } from '../packages/pricehubble/src/client/httpClient.js';
import { stdoutProtokoll } from '../packages/pricehubble/src/client/protokoll.js';
import { TokenVerwaltung } from '../packages/pricehubble/src/client/tokenVerwaltung.js';
import { systemUhr } from '../packages/pricehubble/src/client/uhr.js';
import { jitterStromAusLaufSeed } from '../packages/pricehubble/src/client/zufall.js';
import {
  pruefeApiKonfiguration,
  pruefeUmgebung,
  type ApiKonfiguration,
  type Endpunkte,
} from '../packages/pricehubble/src/config/apiKonfiguration.js';
import type { EndpunktName } from '../packages/pricehubble/src/client/fehler.js';

// `fileURLToPath` statt `.pathname`: Der Ablageort enthaelt Leerzeichen, die in
// einer file-URL prozentkodiert sind und als Pfad nicht mehr aufloesbar waeren.
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PFLICHT = ['PH_BASE_URL', 'PH_USERNAME', 'PH_PASSWORD', 'PH_DOSSIER_ID'] as const;

interface Aufzeichnung {
  readonly datei: string;
  readonly endpunkt: EndpunktName;
  readonly methode: 'GET' | 'POST' | 'PATCH';
  readonly pfad: keyof Endpunkte;
  readonly body?: unknown;
}

function schreibeText(relativ: string, inhalt: string): void {
  const ziel = `${WURZEL}/fixtures/pricehubble/${relativ}`;
  mkdirSync(dirname(ziel), { recursive: true });
  writeFileSync(ziel, inhalt, 'utf8');
}

function schreibe(relativ: string, inhalt: unknown): void {
  schreibeText(relativ, `${JSON.stringify(inhalt, null, 2)}\n`);
}

/** Zugangspruefung aus P1; sie bleibt der erste Riegel vor jedem Netzzugriff. */
function pruefeZugang(env: Record<string, string | undefined>): void {
  const schalter = pruefeUmgebung(env);
  if (schalter !== 'pricehubble') {
    throw new Error(
      `test:record verlangt VALUATION_PROVIDER=pricehubble, gefunden '${schalter}'. `
      + 'Der Aufzeichnungslauf ist an den Meilenstein M-FIX gebunden und laeuft nie im '
      + 'regulaeren Testdurchlauf (Spec 01 §4).',
    );
  }
  const fehlend = PFLICHT.filter((name) => (env[name] ?? '').trim() === '');
  if (fehlend.length > 0) {
    throw new Error(
      `test:record kann nicht laufen: ${fehlend.join(', ')} fehlt bzw. fehlen. `
      + 'Zugangsdaten gehoeren nach .env.local und werden nie eingecheckt.',
    );
  }
}

/**
 * Der `api`-Block stammt aus derselben Konfiguration wie im Betrieb (E-13, G-7);
 * einzig die Basis-URL kommt aus der Umgebung, damit gegen eine Sandbox
 * aufgezeichnet werden kann, ohne die versionierte Konfiguration zu veraendern.
 */
function ladeApiKonfiguration(basisUrl: string): ApiKonfiguration {
  const roh = JSON.parse(
    readFileSync(`${WURZEL}/config/company-defaults.json`, 'utf8'),
  ) as { api: ApiKonfiguration };
  return pruefeApiKonfiguration({ ...roh.api, baseUrl: basisUrl });
}

async function main(): Promise<void> {
  const env: Record<string, string | undefined> = process.env;
  pruefeZugang(env);

  const basisUrl = String(env['PH_BASE_URL']);
  const benutzername = String(env['PH_USERNAME']);
  const passwort = String(env['PH_PASSWORD']);
  const dossierId = String(env['PH_DOSSIER_ID']);

  const konfiguration = ladeApiKonfiguration(basisUrl);
  const client = new HttpClient({
    konfiguration,
    uhr: systemUhr,
    zufall: jitterStromAusLaufSeed(0),
    protokoll: stdoutProtokoll,
    fetchImpl: globalThis.fetch,
  });
  const tokenVerwaltung = new TokenVerwaltung({
    client,
    konfiguration,
    uhr: systemUhr,
    zugangsdaten: { benutzername, passwort },
  });

  const token = await tokenVerwaltung.holeToken();
  if (!token.ok) {
    throw new Error(`Login fehlgeschlagen: ${token.fehler.art}`);
  }
  // Der Token selbst wird nie abgelegt; das Fixture belegt nur die Antwortform.
  schreibe('recorded/auth/login.success.json', { access_token: 'ENTFERNT' });

  const plan: readonly Aufzeichnung[] = [
    {
      datei: 'recorded/dossier/get-dossier.success.json',
      endpunkt: 'dossierGet',
      methode: 'GET',
      pfad: 'dossierGet',
    },
    {
      datei: 'recorded/dossier/update-dossier.success.json',
      endpunkt: 'dossierUpdate',
      methode: 'PATCH',
      pfad: 'dossierUpdate',
      body: { property: { livingArea: 82, numberOfRooms: 3.5, floorNumber: 2 } },
    },
    {
      datei: 'recorded/dossier/valuation.success.json',
      endpunkt: 'dossierValuation',
      methode: 'POST',
      pfad: 'dossierValuation',
      body: {},
    },
    {
      datei: 'recorded/location/location-scores.success.json',
      endpunkt: 'locationScores',
      methode: 'POST',
      pfad: 'locationScores',
      body: {
        location: {
          address: {
            postCode: '8008',
            city: 'Zuerich',
            street: 'Hornbachstrasse',
            houseNumber: '65',
          },
        },
        countryCode: 'CH',
        dossierId,
      },
    },
  ];

  const protokollzeilen: string[] = [];
  for (const eintrag of plan) {
    const antwort = await tokenVerwaltung.mitToken((t) => ({
      endpunkt: eintrag.endpunkt,
      methode: eintrag.methode,
      url: `${konfiguration.baseUrl}${konfiguration.endpunkte[eintrag.pfad].replace('{dossierId}', dossierId)}`,
      timeoutMs:
        eintrag.endpunkt === 'dossierValuation'
          ? konfiguration.timeoutValuationMs
          : konfiguration.timeoutMs,
      token: t,
      ...(eintrag.body === undefined ? {} : { body: eintrag.body }),
    }));
    if (!antwort.ok) {
      throw new Error(`${eintrag.endpunkt} fehlgeschlagen: ${antwort.fehler.art}`);
    }
    // Anonymisierung VOR dem Schreiben (Spec 04 §8.3 Punkt 2): unanonymisiertes
    // Material liegt zu keinem Zeitpunkt auf Platte.
    schreibe(eintrag.datei, anonymisiere(antwort.wert.rumpf));
    protokollzeilen.push(
      JSON.stringify({
        datum: new Date().toISOString(),
        endpunkt: eintrag.endpunkt,
        httpStatus: antwort.wert.httpStatus,
        phRequestId: antwort.wert.phRequestId,
      }),
    );
  }

  schreibeText('recorded/aufzeichnungsprotokoll.jsonl', `${protokollzeilen.join('\n')}\n`);
  schreibe('recorded/herkunft.json', { fixtures_herkunft: 'aufgezeichnet' });
  process.stdout.write('Aufzeichnung abgeschlossen. Abweichungen dokumentieren, nicht einpflegen.\n');
}

try {
  await main();
} catch (fehler) {
  process.stderr.write(`${fehler instanceof Error ? fehler.message : String(fehler)}\n`);
  process.exit(1);
}
