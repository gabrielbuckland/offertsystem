/**
 * Keine Formel. Dateibasierte Ablage der Offerttext-Vorlage (Spec 2026-08-27 §1).
 *
 * Fehlende Datei ist KEIN Fehler, sondern der Auslieferungszustand: Es gilt die
 * eingebaute Neubau-Standardvorlage. Geschrieben wird nur nach bestandener Prüfung
 * (zurückweisen statt melden, I-21) — Schema UND Katalogzugehörigkeit jedes
 * Platzhalters, denn eine Vorlage mit unbekanntem Platzhalter liesse JEDES
 * Finalisieren scheitern; der richtige Zeitpunkt für die Meldung ist das Speichern.
 */
import * as fs from 'node:fs/promises';
import {
  offertDokumentSchema, sammlePlatzhalterIds, type OffertDokument,
} from '@offert/offer/src/vorlage/dokument-schema.js';
import { PLATZHALTER_KATALOG } from '@offert/offer/src/vorlage/platzhalter.js';
import {
  VORLAGE_VERSION, standardVorlage,
} from '@offert/offer/src/vorlage/standard-vorlage.js';
import { z } from 'zod';

export interface VorlagenDatei {
  readonly version: string;
  readonly inhalt: OffertDokument;
}

const vorlagenDateiSchema = z.object({
  version: z.string().min(1),
  inhalt: offertDokumentSchema,
}).strict();

export async function ladeVorlage(pfad: string): Promise<VorlagenDatei> {
  const roh = await fs.readFile(pfad, 'utf8').catch(() => undefined);
  if (roh === undefined) return { version: VORLAGE_VERSION, inhalt: standardVorlage() };
  return vorlagenDateiSchema.parse(JSON.parse(roh));
}

export type SchreibErgebnis =
  | { readonly ok: true }
  | { readonly ok: false; readonly befunde: readonly { pfad: string; text: string }[] };

export async function schreibeVorlage(roh: unknown, pfad: string): Promise<SchreibErgebnis> {
  const geparst = vorlagenDateiSchema.safeParse(roh);
  if (!geparst.success) {
    return {
      ok: false,
      befunde: geparst.error.issues.map((i) => ({
        pfad: i.path.join('.'), text: i.message,
      })),
    };
  }
  const katalog = new Set(PLATZHALTER_KATALOG.map((e) => e.id));
  const fremde = sammlePlatzhalterIds(geparst.data.inhalt).filter((id) => !katalog.has(id));
  if (fremde.length > 0) {
    return {
      ok: false,
      befunde: fremde.map((id) => ({
        pfad: 'inhalt', text: `Unbekannter Platzhalter «${id}».`,
      })),
    };
  }
  await fs.writeFile(pfad, `${JSON.stringify(geparst.data, null, 2)}\n`, 'utf8');
  return { ok: true };
}
