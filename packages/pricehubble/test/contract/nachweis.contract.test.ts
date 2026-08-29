import { fileURLToPath } from 'node:url';
import { afterAll, expect, it } from 'vitest';
import { DossierResponseSchema } from '../../src/schema/dossier-response.js';
import { LocationScoresResponseSchema } from '../../src/schema/location-scores-response.js';
import { LoginResponseSchema } from '../../src/schema/login-response.js';
import { ValuationResponseSchema } from '../../src/schema/valuation-response.js';
import { ladeFixture } from '../fixtures.js';
import { schreibeNachweisArtefakt } from '../nachweis/schreibe-artefakt.js';

const FAELLE = [
  ['loginResponse', LoginResponseSchema, 'synthetic/auth/login.success.json'],
  ['dossierResponse', DossierResponseSchema, 'synthetic/dossier/get-dossier.success.json'],
  ['valuationResponse', ValuationResponseSchema, 'synthetic/dossier/valuation.success.json'],
  [
    'locationScoresResponse',
    LocationScoresResponseSchema,
    'synthetic/location/location-scores.success.json',
  ],
] as const;

const beginn = Date.now();
let bestanden = 0;

it.each(FAELLE)('Vertrag %s haelt gegen die Fixture', (_name, schema, fixture) => {
  expect(schema.safeParse(ladeFixture(fixture)).success).toBe(true);
  bestanden += 1;
});

afterAll(() => {
  schreibeNachweisArtefakt(
    // `fileURLToPath` statt `.pathname`: Der Repositorypfad enthaelt Leerzeichen, die
    // `import.meta.url` prozentkodiert — `.pathname` liefert sie kodiert zurueck und
    // legte das Artefakt in einem Verzeichnis mit '%20' an.
    fileURLToPath(new URL('../../../../artifacts/', import.meta.url)),
    'contract',
    {
      systemverhalten:
        'Zod-Contract-Schemata gegen den Fixture-Bestand geprueft; kein Netzwerkzugriff',
      fehlerstatus: 'keiner',
      pipelineZustand: 'nicht gestartet',
      ergebnis: bestanden === FAELLE.length ? 'pass' : 'fail',
      anzahlTests: FAELLE.length,
      laufzeitMs: Date.now() - beginn,
      // Contract-Tests melden eine Vertragsabweichung, sie verhindern sie nicht.
      wirkung: 'detektiv',
      // Solange Aufgabe 18 blockiert ist, gibt es keine aufgezeichneten Fixtures (G-2).
      fixtures_herkunft: 'synthetisch',
    },
  );
});
