/**
 * Reine Weiche, ob ein vom Editor gelieferter ProseMirror-JSON-Zustand die
 * Zod-Teilmenge des Offerttext-Dokuments trägt (C-1). Aus `OffertTextEditor`
 * herausgezogen, weil das Repo keine DOM-/TipTap-Tests führt (`environment: 'node'`).
 *
 * Der TipTap-Editor ist auf dieselbe Teilmenge konfiguriert; diese Prüfung ist die
 * zweite Absicherung, kein Ersatz dafür — sie fängt jeden Zustand ab, den die
 * Editor-Konfiguration wider Erwarten doch zulässt (I-21).
 */
import { offertDokumentSchema, type OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';

export function istGueltigesOffertDokument(dokument: unknown): dokument is OffertDokument {
  return offertDokumentSchema.safeParse(dokument).success;
}
