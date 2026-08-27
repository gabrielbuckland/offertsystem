/**
 * Keine Formel. Gemeinsamer Schreibweg fuer dateibasierte Ablagen (I-3, Review
 * feature/offert-vorlage).
 *
 * Vorher stand dieselbe Temp-plus-`rename`-Folge zweimal wortgleich in
 * `projekt-ablage.ts` und `einstellungen-ablage.ts`; ein dritter Zugang
 * (`vorlagen-ablage.ts`) schrieb stattdessen direkt mit `fs.writeFile` und liess ein
 * abgebrochenes Schreiben als abgeschnittene Datei zurueck. Ein Ort statt drei
 * Kopien haelt das Muster konsistent nachziehbar.
 *
 * Erst vollstaendig in eine Temp-Datei schreiben, dann verknuepfen (`rename`): Ein
 * Absturz mitten im Schreiben oder zwei gleichzeitige Schreibvorgaenge hinterlassen so
 * nie eine abgeschnittene Zieldatei — entweder der alte oder der neue Stand ist
 * vollstaendig da.
 */
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
