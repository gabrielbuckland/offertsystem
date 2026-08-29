// Reine Logik von `ProjektOfferten.tsx`, getrennt von der Darstellung, damit sie ohne
// Rendering testbar ist.

// Dieselbe Kuerzung wie im Dateinamen (`dateinameFuer` in `offerten-ablage.ts`, Spec 05
// §2/§8): die Kennung dient nur der Unterscheidung mehrerer Offerten desselben Tages.
export function referenzAus(offertId: string): string {
  return offertId.slice(0, 8);
}
