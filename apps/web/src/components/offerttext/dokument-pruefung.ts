/**
 * Reine Weiche, ob ein vom Editor gelieferter ProseMirror-JSON-Zustand die
 * Zod-Teilmenge des Offerttext-Dokuments (dokument-schema.ts, packages/offer) trägt
 * (C-1). Aus `OffertTextEditor` herausgezogen, weil das Repo keine
 * DOM-/TipTap-Tests führt (`environment: 'node'`, vitest.workspace.ts) — als reine
 * Funktion lässt sich die Entscheidung trotzdem ohne Editor prüfen.
 *
 * Der TipTap-Editor ist auf dieselbe Teilmenge konfiguriert (StarterKit mit
 * eingeschränktem `listItem`, gesperrter `preistabelle`-Einfügung in Listen) — diese
 * Prüfung ist die zweite Absicherung, kein Ersatz dafür: Sie fängt jeden Zustand ab,
 * den die Editor-Konfiguration wider Erwarten doch zulässt, BEVOR er den Projekt-
 * bzw. Vorlagenstand erreicht (I-21: zurückweisen statt melden, hier am Ort des
 * Entstehens).
 */
import { offertDokumentSchema, type OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';

export function istGueltigesOffertDokument(dokument: unknown): dokument is OffertDokument {
  return offertDokumentSchema.safeParse(dokument).success;
}
