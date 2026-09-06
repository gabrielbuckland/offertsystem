/**
 * Laufzeit: node --experimental-strip-types (PE-09). Kein Vitest-Test: braucht einen
 * laufenden Server, belegt genau eine Aussage (Druckpfad erzeugt ein PDF).
 * Import relativ auf die Quelle statt ueber @offert/offer: Node verweigert Type-Stripping
 * fuer Pakete aus node_modules, wohin Workspace-Pakete verknuepft werden (PE-09).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { druckeOfferte } from '../packages/offer/src/pdf/drucke-offerte.js';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MINDESTGROESSE = 10_000;

const offertId = process.argv[2];
if (offertId === undefined) {
  process.stderr.write('Aufruf: npm run pdf:smoke -- <offertId> [basisUrl] (Server muss laufen)\n');
  process.exit(1);
}

const pdf = await druckeOfferte({
  basisUrl: process.argv[3] ?? 'http://localhost:3000',
  offertId,
});

if (!pdf.subarray(0, 5).toString('latin1').startsWith('%PDF-') || pdf.length < MINDESTGROESSE) {
  process.stderr.write(`pdf:smoke fehlgeschlagen — ${pdf.length} Bytes, kein gueltiger PDF-Kopf.\n`);
  process.exit(1);
}

const ziel = `${WURZEL}/artifacts/manual/pdf-smoke.pdf`;
mkdirSync(dirname(ziel), { recursive: true });
writeFileSync(ziel, pdf);
process.stdout.write(`pdf:smoke ok — ${pdf.length} Bytes.\n`);
