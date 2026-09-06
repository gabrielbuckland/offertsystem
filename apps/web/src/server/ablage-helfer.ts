// I-3: Erst in Temp-Datei schreiben, dann per `rename` verknuepfen — so hinterlaesst ein
// Absturz oder ein gleichzeitiger Schreibvorgang nie eine abgeschnittene Zieldatei.
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { dirname } from 'node:path';

export async function schreibeAtomar(ziel: string, inhalt: string): Promise<void> {
  await fs.mkdir(dirname(ziel), { recursive: true });
  const temp = `${ziel}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, inhalt, 'utf8');
  try {
    await fs.rename(temp, ziel);
  } catch (fehler) {
    await fs.rm(temp, { force: true });
    throw fehler;
  }
}
