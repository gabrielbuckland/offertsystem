// Ein Startwert je Testlauf; fast-check erhaelt `seed`, die Jitter-Quelle des Adapters
// den abgeleiteten Strom `seed XOR 1` (E-27). Das Protokollfeld bleibt einwertig.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { execSync } from 'node:child_process';
import fc from 'fast-check';
import konfig from './seed.json' with { type: 'json' };

export default function setup(): () => void {
  const seed = process.env['FC_SEED'] !== undefined
    ? Number.parseInt(process.env['FC_SEED'], 10)
    : konfig.seed;
  if (!Number.isInteger(seed)) {
    throw new Error('FC_SEED muss ganzzahlig sein; es gibt keinen Zeitstempel-Rueckfall');
  }
  // Wirksam wird die Konfiguration erst im Arbeitsprozess (siehe setup.ts); hier gesetzt
  // wirkt sie nur fuer den Hauptprozess und damit fuer keinen Test. Weitergereicht wird
  // ueber die Umgebung, die die Arbeitsprozesse beim Abzweigen erben.
  process.env['FC_SEED'] = String(seed);
  process.env['FC_NUM_RUNS'] = String(konfig.numRuns);
  fc.configureGlobal({ seed, numRuns: konfig.numRuns, verbose: 1 });

  const zeitstempel = new Date().toISOString().replace(/[:.]/g, '-');
  const verzeichnis = `artifacts/property/${zeitstempel}`;
  mkdirSync(`${verzeichnis}/roh`, { recursive: true });
  // Die Testprozesse erben die Umgebung beim Abzweigen; darueber finden sie das
  // Laufverzeichnis, ohne den Zeitstempel ein zweites Mal zu bilden.
  process.env['PROPERTY_LAUF'] = verzeichnis;

  writeFileSync(`${verzeichnis}/run-meta.json`, `${JSON.stringify({
    seed,
    numRuns: konfig.numRuns,
    abgeleitete_stroeme: { jitter: 'seed XOR 1' },
    commit: execSync('git rev-parse HEAD').toString().trim(),
    node: process.version,
    fastcheck: fc.__version,
    startzeit: new Date().toISOString(),
    hostname: hostname(),
  }, null, 2)}\n`);

  // PE-18: P5 liest properties.json und den latest-Zeiger.
  return () => {
    const properties = readdirSync(`${verzeichnis}/roh`)
      .filter((d) => d.endsWith('.json'))
      .sort()
      .map((d) => JSON.parse(readFileSync(`${verzeichnis}/roh/${d}`, 'utf8')) as unknown);
    writeFileSync(`${verzeichnis}/properties.json`,
      `${JSON.stringify({ seed, numRuns: konfig.numRuns, properties }, null, 2)}\n`);
    writeFileSync('artifacts/property/latest.json',
      `${JSON.stringify({ verzeichnis, zeitstempel }, null, 2)}\n`);
  };
}
