/**
 * Keine Formel. Dateibasierte Ablage der Offerttext-Vorlage (Spec 2026-08-27 §1).
 *
 * Fehlende Datei ist KEIN Fehler, sondern der Auslieferungszustand: Es gilt die
 * eingebaute Neubau-Standardvorlage. Geschrieben wird nur nach bestandener Prüfung
 * (zurückweisen statt melden, I-21) — Schema UND Katalogzugehörigkeit jedes
 * Platzhalters, denn eine Vorlage mit unbekanntem Platzhalter liesse JEDES
 * Finalisieren scheitern; der richtige Zeitpunkt für die Meldung ist das Speichern.
 *
 * Katalogzugehörigkeit wird pro Knotenart geprüft (M-1): Ein INLINE-Platzhalter mit
 * `id: 'preistabelle'` wäre zwar im Katalog gelistet, aber die Auflösung
 * (aufloesung.ts) kennt ihn nur als eigenen Blockknoten (`platzhalterTabelle`) — als
 * inline-Text-Platzhalter bliebe er beim Finalisieren unauflösbar, obwohl er die
 * Speicherprüfung bestünde. `sammlePlatzhalterIds` liefert deshalb die Knotenart mit.
 */
import * as fs from 'node:fs/promises';
import {
  offertDokumentSchema, sammlePlatzhalterIds, type OffertDokument,
} from '@offert/offer/src/vorlage/dokument-schema.js';
import { TEXT_PLATZHALTER } from '@offert/offer/src/vorlage/platzhalter.js';
import {
  VORLAGE_VERSION, standardVorlage,
} from '@offert/offer/src/vorlage/standard-vorlage.js';
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

/** Rumpfschema fuer das Schreiben: `version` wird entgegengenommen, aber ignoriert
 *  (I-5) — die abgelegte Version bestimmt ausschliesslich der Server. */
const vorlagenSchreibRumpfSchema = z.object({
  version: z.string().optional(),
  inhalt: offertDokumentSchema,
}).strict();

/**
 * `Ergebnis<T>` statt Wurf (I-4): Ein defektes Artefakt (kaputtes JSON, Schemabruch)
 * ist ein Befund, keine Ausnahme — die Aufrufer (beide API-Routen) uebersetzen ihn in
 * eine benannte Meldung statt in eine unbehandelte 500.
 */
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
  // I-5: Die Version identifiziert die Vorlage inhaltlich (dasselbe Mittel wie
  // `konfigPruefsumme`, kanonisch.ts) statt eine vom Client mitgesendete Zahl
  // unveraendert zu uebernehmen — sonst triege jedes Artefakt dieselbe «1», egal wie
  // oft die Vorlage inhaltlich geaendert wurde, und ein POST mit `version: "42"`
  // schriebe diesen Wert unbesehen fest.
  const datei: VorlagenDatei = {
    version: bildePruefsumme(geparst.data.inhalt),
    inhalt: geparst.data.inhalt,
  };
  // I-3: atomar (Temp + rename) statt eines direkten `writeFile`, das bei einem
  // Abbruch mitten im Schreiben oder zwei gleichzeitigen POSTs eine abgeschnittene
  // Datei zurueckliesse; `schreibeAtomar` legt das Zielverzeichnis bei Bedarf an.
  await schreibeAtomar(pfad, `${JSON.stringify(datei, null, 2)}\n`);
  return { ok: true };
}
