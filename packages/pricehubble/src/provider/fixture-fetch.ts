/**
 * Keine Formel. Fixture-Transport (E-31): bedient den HttpClient mit den per
 * `test:record` aufgezeichneten Antworten der produktiven API — ohne Netz und ohne
 * Zugangsdaten. Ersetzt NUR `fetch`; Token-Verwaltung, Schemavalidierung, ACL und
 * PATCH-Rueckvergleich laufen unveraendert im echten Adapter.
 *
 * Die Antworten werden byte-identisch ausgeliefert. Der PATCH-Rueckvergleich des
 * Adapters besteht deshalb nur fuer eine Parametrisierung, die dem aufgezeichneten
 * Dossierstand entspricht — jede Abweichung meldet er als ContractViolation.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { KonfigurationsFehler } from '../config/konfigurations-fehler.js';
import type { Endpunkte } from '../config/api-konfiguration.js';

const SUCHTIEFE = 6;

/**
 * Sucht den Aufzeichnungsbestand vom Startverzeichnis aufwaerts: Der Aufruf erfolgt je
 * nach Einstieg aus der Repositorywurzel (tools/) oder aus `apps/web` (Next, Vitest).
 */
export function findeAufzeichnungsVerzeichnis(start: string = process.cwd()): string {
  let aktuell = resolve(start);
  for (let stufe = 0; stufe < SUCHTIEFE; stufe += 1) {
    const kandidat = join(aktuell, 'fixtures', 'pricehubble', 'recorded');
    if (existsSync(join(kandidat, 'herkunft.json'))) {
      return kandidat;
    }
    const eltern = dirname(aktuell);
    if (eltern === aktuell) {
      break;
    }
    aktuell = eltern;
  }
  throw new KonfigurationsFehler(
    'VALUATION_PROVIDER',
    'fixture verlangt aufgezeichnete Antworten unter fixtures/pricehubble/recorded (test:record)',
  );
}

interface Route {
  readonly methode: string;
  readonly muster: RegExp;
  readonly datei: string;
}

function alsMuster(schablone: string): RegExp {
  return new RegExp(`^${schablone.replace('{dossierId}', '[^/]+')}$`);
}

function erzeugeRouten(endpunkte: Endpunkte): readonly Route[] {
  return [
    { methode: 'POST', muster: alsMuster(endpunkte.login), datei: 'auth/login.success.json' },
    { methode: 'GET', muster: alsMuster(endpunkte.dossierGet), datei: 'dossier/get-dossier.success.json' },
    { methode: 'PATCH', muster: alsMuster(endpunkte.dossierUpdate), datei: 'dossier/update-dossier.success.json' },
    { methode: 'POST', muster: alsMuster(endpunkte.dossierValuation), datei: 'dossier/valuation.success.json' },
    { methode: 'POST', muster: alsMuster(endpunkte.locationScores), datei: 'location/location-scores.success.json' },
  ];
}

export function erzeugeFixtureFetch(endpunkte: Endpunkte, verzeichnis: string): typeof fetch {
  const routen = erzeugeRouten(endpunkte);
  return async (eingabe, init) => {
    const url = new URL(
      typeof eingabe === 'string' ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url,
    );
    const methode = init?.method ?? 'GET';
    const route = routen.find((r) => r.methode === methode && r.muster.test(url.pathname));
    if (route === undefined) {
      // 404 statt Wurf: deterministischer NotFoundError ohne Retry-Wartezeiten.
      return new Response(
        JSON.stringify({ message: `keine Aufzeichnung fuer ${methode} ${url.pathname}` }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(readFileSync(join(verzeichnis, route.datei), 'utf8'), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-ph-request-id': 'aufzeichnung' },
    });
  };
}
