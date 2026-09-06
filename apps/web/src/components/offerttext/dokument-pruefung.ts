// C-1/I-21: zweite Absicherung neben der TipTap-Konfiguration, kein Ersatz dafuer.
// Aus OffertTextEditor ausgelagert, da das Repo keine DOM-/TipTap-Tests fuehrt.
import { offertDokumentSchema, type OffertDokument } from '@offert/offer';

export function istGueltigesOffertDokument(dokument: unknown): dokument is OffertDokument {
  return offertDokumentSchema.safeParse(dokument).success;
}
