/**
 * Aufzeichnungspfad fuer PriceHubble-Fixtures (E-31). Laufzeit: node --experimental-strip-types
 * (Node >= 22.6, PE-09), kein tsx; Importe relativ, da Node Type-Stripping fuer node_modules
 * verweigert (PE-09, PE-11).
 * EINZIGES Skript mit echtem API-Zugriff, nie Teil von verify/test: verbraucht kontingentierte
 * Abrufe, verlangt Zugangsdaten und veraendert versioniertes Testmaterial.
 * Einziger zulaessiger Weg, auf dem Dateien unter fixtures/pricehubble/recorded/ entstehen —
 * von Hand abgelegte Dateien waeren in ihrer Herkunft nicht belegt.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anonymisiere } from '../packages/pricehubble/src/acl/anonymisierung.js';
import { HttpClient } from '../packages/pricehubble/src/client/http-client.js';
import { stdoutProtokoll } from '../packages/pricehubble/src/client/protokoll.js';
import { TokenVerwaltung, type Zugang } from '../packages/pricehubble/src/client/token-verwaltung.js';
import { systemUhr } from '../packages/pricehubble/src/client/uhr.js';
import { jitterStromAusLaufSeed } from '../packages/pricehubble/src/client/zufall.js';
import {
  pruefeApiKonfiguration,
  pruefeUmgebung,
  type ApiKonfiguration,
  type Endpunkte,
} from '../packages/pricehubble/src/config/api-konfiguration.js';
import type { EndpunktName } from '../packages/pricehubble/src/client/fehler.js';

// fileURLToPath statt .pathname: der Ablageort kann Leerzeichen enthalten, die eine
// file-URL prozentkodiert und als Pfad sonst nicht mehr aufloesbar waeren.
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PFLICHT = ['PH_BASE_URL', 'PH_DOSSIER_ID'] as const;

// Zwei zulaessige Zugangswege: PH_USERNAME/PH_PASSWORD oder ein von Hand besorgter
// PH_ACCESS_TOKEN; der Token-Weg erlaubt den Lauf ohne Zugangsdaten im Prozess (E-31).
function leseZugang(env: Record<string, string | undefined>): Zugang {
  const token = (env['PH_ACCESS_TOKEN'] ?? '').trim();
  if (token !== '') {
    return { art: 'token', token };
  }
  const benutzername = (env['PH_USERNAME'] ?? '').trim();
  const passwort = (env['PH_PASSWORD'] ?? '').trim();
  if (benutzername === '' || passwort === '') {
    throw new Error(
      'test:record kann nicht laufen: entweder PH_USERNAME und PH_PASSWORD setzen '
      + 'oder PH_ACCESS_TOKEN aus einem manuellen Login. Zugangsdaten gehoeren nach '
      + '.env.local und werden nie eingecheckt.',
    );
  }
  return { art: 'zugangsdaten', benutzername, passwort };
}

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

// Zugangspruefung aus P1; erster Riegel vor jedem Netzzugriff.
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

// Der api-Block stammt aus derselben Konfiguration wie im Betrieb (E-13, G-7); nur die
// Basis-URL kommt aus der Umgebung, damit gegen eine Sandbox aufgezeichnet werden kann.
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
  const zugang = leseZugang(env);
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
    zugang,
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
            // Muss der Dossier-Adresse exakt entsprechen: Mit 'Zuerich' lehnt die API
            // die Referenz ab (403 «Request is not allowed with this reference»).
            city: 'Zürich',
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
    // Anonymisierung VOR dem Schreiben: unanonymisiertes Material liegt zu keinem
    // Zeitpunkt auf Platte.
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
