/**
 * Reine Logik von `ProjektOfferten.tsx`, getrennt von der Darstellung, damit sie ohne
 * Rendering testbar ist (Vorbild `zellen-logik.ts`, `faktoren-logik.ts`).
 */

/**
 * Referenz einer Offerte fuer die Liste: die ersten acht Zeichen der `offertId`.
 * Dieselbe Kuerzung wie im Dateinamen (`dateinameFuer` in `offerten-ablage.ts`) —
 * beide entstammen derselben Ueberlegung (Spec 05 §2/§8): Adresse und Datum
 * identifizieren das Projekt, die Kennung dient nur der Unterscheidung mehrerer
 * Offerten desselben Tages.
 */
export function referenzAus(offertId: string): string {
  return offertId.slice(0, 8);
}
