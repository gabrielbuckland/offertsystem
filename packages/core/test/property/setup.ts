/**
 * Wirksame fast-check-Konfiguration je Testprozess.
 *
 * WARUM DIESE DATEI NOETIG IST: `globalSetup` laeuft im Hauptprozess, die Testdateien
 * laufen in abgezweigten Arbeitsprozessen. `fc.configureGlobal` wirkt nur im eigenen
 * Prozess und erreicht die Arbeiter nicht. Ohne diese Datei liefen die Properties mit
 * fast-checks Vorgabe von 100 Laeufen und einem ZUFAELLIGEN Seed, waehrend
 * `properties.json` 1000 Laeufe mit festem Seed auswiese — ein gruener Nachweis ohne
 * Deckung, und der Seed-Mechanismus waere wirkungslos.
 *
 * `globalSetup` reicht die beiden Werte ueber die Umgebung weiter; Arbeitsprozesse erben
 * sie beim Abzweigen. Denselben Weg nimmt bereits `PROPERTY_LAUF`.
 */
import { beforeAll } from 'vitest';
import fc from 'fast-check';

beforeAll(() => {
  const rohSeed = process.env['FC_SEED'];
  const rohRuns = process.env['FC_NUM_RUNS'];
  if (rohSeed === undefined || rohRuns === undefined) {
    // Einzellauf ohne globalSetup: fast-checks Vorgaben bleiben stehen. Das ist zulaessig,
    // solange kein Artefakt geschrieben wird — `haltePropertyFest` schweigt dann ebenfalls.
    return;
  }
  const seed = Number.parseInt(rohSeed, 10);
  const numRuns = Number.parseInt(rohRuns, 10);
  if (!Number.isInteger(seed) || !Number.isInteger(numRuns)) {
    throw new Error('FC_SEED und FC_NUM_RUNS muessen ganzzahlig sein; es gibt keinen Rueckfall');
  }
  fc.configureGlobal({ seed, numRuns, verbose: 1 });
});
