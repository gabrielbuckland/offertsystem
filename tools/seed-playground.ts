// predev-Hook vor npm run dev: seedet nur eine leere Projektablage, bestehende
// Arbeitsstaende werden nie angefasst.
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Muss der `id` in data/seed/playground-projekt.json entsprechen. */
export const PLAYGROUND_ID = '11111111-1111-4111-8111-111111111111';

// E-31: Nur ein zur Aufzeichnung passender Seed uebersteht den PATCH-Rueckvergleich.
export function seedQuelle(provider: string | undefined): string {
  return join(WURZEL, 'data', 'seed',
              provider === 'fixture' ? 'fixture-projekt.json' : 'playground-projekt.json');
}

export function seedePlayground(verzeichnis: string, quelle: string = seedQuelle(undefined)): boolean {
  mkdirSync(verzeichnis, { recursive: true });
  const vorhandene = readdirSync(verzeichnis).filter((n) => n.endsWith('.json'));
  if (vorhandene.length > 0) {
    return false;
  }
  const { id } = JSON.parse(readFileSync(quelle, 'utf8')) as { id: string };
  copyFileSync(quelle, join(verzeichnis, `${id}.json`));
  return true;
}

if (import.meta.filename === process.argv[1]) {
  const verzeichnis = process.env['PROJEKTE_VERZEICHNIS'] ?? join(WURZEL, 'data', 'projekte');
  if (seedePlayground(verzeichnis, seedQuelle(process.env['VALUATION_PROVIDER']))) {
    process.stdout.write('Playground-Projekt in die leere Projektablage gelegt.\n');
  }
}
