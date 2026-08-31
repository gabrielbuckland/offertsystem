// Dateibasierte Ablage der Offerttext-Vorlage (Spec 2026-08-27 §1). Fehlende Datei ist kein
// Fehler, sondern der Auslieferungszustand (eingebaute Neubau-Standardvorlage gilt).
// Geschrieben wird nur nach bestandener Pruefung: I-21 zurueckweisen statt melden (eine
// Vorlage mit unbekanntem Platzhalter liesse jedes Finalisieren scheitern), M-1
// Katalogzugehoerigkeit pro Knotenart (ein inline-Platzhalter `preistabelle` ist im Katalog
// gelistet, aber nur als Blockknoten aufloesbar — `sammlePlatzhalterIds` liefert daher die
// Knotenart mit).
import * as fs from 'node:fs/promises';
import {
  offertDokumentSchema, sammlePlatzhalterIds, type OffertDokument,
  TEXT_PLATZHALTER, VORLAGE_VERSION, standardVorlage,
} from '@offert/offer';
import { z } from 'zod';
import { schreibeAtomar } from './ablage-helfer.js';
import { bildePruefsumme } from './kanonisch.js';
import type { Ergebnis } from './eingang.js';

export interface VorlagenDatei {
  readonly version: string;
  readonly inhalt: OffertDokument;
}

const vorlagenDateiSchema = z.object({
  version: z.string().min(1),
  inhalt: offertDokumentSchema,
}).strict();

// I-5: `version` wird entgegengenommen, aber ignoriert — die abgelegte Version bestimmt
// ausschliesslich der Server.
const vorlagenSchreibRumpfSchema = z.object({
  version: z.string().optional(),
  inhalt: offertDokumentSchema,
}).strict();

// I-4: `Ergebnis<T>` statt Wurf — ein defektes Artefakt ist ein Befund, keine Ausnahme.
export async function ladeVorlage(pfad: string): Promise<Ergebnis<VorlagenDatei>> {
  const roh = await fs.readFile(pfad, 'utf8').catch(() => undefined);
  if (roh === undefined) {
    return { ok: true, wert: { version: VORLAGE_VERSION, inhalt: standardVorlage() } };
  }
  let geparst: unknown;
  try {
    geparst = JSON.parse(roh);
  } catch {
    return { ok: false, meldung: `Die Offerttext-Vorlage (${pfad}) enthält kein gültiges JSON.` };
  }
  const ergebnis = vorlagenDateiSchema.safeParse(geparst);
  if (!ergebnis.success) {
    return {
      ok: false,
      meldung: `Die Offerttext-Vorlage (${pfad}) entspricht nicht dem erwarteten Format.`,
    };
  }
  return { ok: true, wert: ergebnis.data };
}

export type SchreibErgebnis =
  | { readonly ok: true }
  | { readonly ok: false; readonly befunde: readonly { pfad: string; text: string }[] };

export async function schreibeVorlage(roh: unknown, pfad: string): Promise<SchreibErgebnis> {
  const geparst = vorlagenSchreibRumpfSchema.safeParse(roh);
  if (!geparst.success) {
    return {
      ok: false,
      befunde: geparst.error.issues.map((i) => ({
        pfad: i.path.join('.'), text: i.message,
      })),
    };
  }
  const inlineKatalog = new Set<string>(TEXT_PLATZHALTER);
  const fremde = sammlePlatzhalterIds(geparst.data.inhalt).filter((v) => (
    v.art === 'inline' ? !inlineKatalog.has(v.id) : v.id !== 'preistabelle'
  ));
  if (fremde.length > 0) {
    return {
      ok: false,
      befunde: fremde.map((v) => ({
        pfad: 'inhalt', text: `Unbekannter Platzhalter «${v.id}».`,
      })),
    };
  }
  // I-5: Version identifiziert die Vorlage inhaltlich (wie `konfigPruefsumme`) statt eine
  // vom Client mitgesendete Zahl unveraendert zu uebernehmen.
  const datei: VorlagenDatei = {
    version: bildePruefsumme(geparst.data.inhalt),
    inhalt: geparst.data.inhalt,
  };
  // I-3: atomar (Temp + rename) statt direktem `writeFile`, das bei Abbruch oder
  // gleichzeitigen POSTs eine abgeschnittene Datei zurueckliesse.
  await schreibeAtomar(pfad, `${JSON.stringify(datei, null, 2)}\n`);
  return { ok: true };
}
