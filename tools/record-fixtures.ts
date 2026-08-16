/**
 * Aufzeichnungspfad M-FIX (E-31, Spec 01 §4).
 * EINZIGES Skript mit echtem API-Zugriff. Nie Teil von `verify` oder `test`.
 *
 * ZUSTAENDIGKEIT (PE-11): Hier stehen Ort, Zugangspruefung und Abbruchpfad.
 * Die eigentliche Aufzeichnung — Login, Endpunktreihenfolge, Anonymisierung und
 * Protokollierung — ergaenzt der Adapter-Plan IN DIESER DATEI. Bis dahin bricht
 * das Skript definiert ab, statt stillschweigend nichts zu tun.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const ZIEL = 'fixtures/pricehubble/recorded';
const PFLICHT = ['PH_BASE_URL', 'PH_USERNAME', 'PH_PASSWORD', 'PH_DOSSIER_ID'] as const;

const schalter = process.env['VALUATION_PROVIDER'];
if (schalter !== 'pricehubble') {
  console.error(
    `test:record verlangt VALUATION_PROVIDER=pricehubble, gefunden '${schalter ?? '(nicht gesetzt)'}'.\n`
    + 'Der Aufzeichnungslauf ist an den Meilenstein M-FIX gebunden und laeuft nie im\n'
    + 'regulaeren Testdurchlauf (Spec 01 §4).',
  );
  process.exit(1);
}

const fehlend = PFLICHT.filter((name) => (process.env[name] ?? '').trim() === '');
if (fehlend.length > 0) {
  console.error(
    `test:record kann nicht laufen: ${fehlend.join(', ')} fehlt bzw. fehlen.\n`
    + 'Zugangsdaten gehoeren nach .env.local und werden nie eingecheckt.',
  );
  process.exit(1);
}

if (!existsSync(ZIEL)) mkdirSync(ZIEL, { recursive: true });

writeFileSync(
  `${ZIEL}/aufzeichnung.meta.json`,
  `${JSON.stringify({
    fixtures_herkunft: 'aufgezeichnet',
    aufgezeichnet_am: new Date().toISOString(),
    basisUrl: process.env['PH_BASE_URL'],
    hinweis: 'Antwortkoerper werden vom Adapter-Plan ergaenzt; Anonymisierung erfolgt vor dem Schreiben.',
  }, null, 2)}\n`,
  'utf8',
);

console.error(
  'Voraussetzungen erfuellt und Zielverzeichnis vorbereitet.\n'
  + 'Die Aufzeichnung der Endpunkte (auth/Login, dossier/Get, dossier/Update,\n'
  + 'dossier/Valuation, location/Scores) ergaenzt der Adapter-Plan in dieser Datei.\n'
  + 'Offene Nachweisluecke nach Brief §7: Die Uebereinstimmung des Contract-Schemas\n'
  + 'mit der realen PriceHubble-Antwort ist bis dahin unbelegt.',
);
process.exit(1);
