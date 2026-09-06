// predev-Hook vor npm run dev: seedet nur eine leere Projektablage, bestehende
// Arbeitsstaende werden nie angefasst.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = join(WURZEL, 'data', 'seed', 'playground-projekt.json');

/** Muss der `id` in data/seed/playground-projekt.json entsprechen. */
export const PLAYGROUND_ID = '11111111-1111-4111-8111-111111111111';

export function seedePlayground(verzeichnis: string, quelle: string = QUELLE): boolean {
  mkdirSync(verzeichnis, { recursive: true });
  const vorhandene = readdirSync(verzeichnis).filter((n) => n.endsWith('.json'));
  if (vorhandene.length > 0) {
    return false;
  }
  copyFileSync(quelle, join(verzeichnis, `${PLAYGROUND_ID}.json`));
  return true;
}

if (import.meta.filename === process.argv[1]) {
  const verzeichnis = process.env['PROJEKTE_VERZEICHNIS'] ?? join(WURZEL, 'data', 'projekte');
  if (seedePlayground(verzeichnis)) {
    process.stdout.write('Playground-Projekt in die leere Projektablage gelegt.\n');
  }
}
