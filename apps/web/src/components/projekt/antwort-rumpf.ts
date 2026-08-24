/**
 * Reine Lesehilfe fuer Antwortrumpfe, getrennt von `ProjektAnsicht.tsx`, damit sie ohne
 * DOM testbar ist (gleiches Vorgehen wie `zellen-logik.ts`).
 *
 * Wirft eine Route einen unbehandelten Fehler, liefert Next eine HTML-Fehlerseite mit
 * Status 500. `antwort.json()` scheitert an deren Rumpf und lehnt ab; in einem
 * `try/finally` ohne `catch` entkommt diese Ablehnung aus dem `void`-Aufruf des
 * Klickhandlers, und die Schaltflaeche bleibt fuer den Vermarkter schlicht wirkungslos.
 * Ein leerer Rumpf laesst den Aufrufer stattdessen seine Statusauswertung erreichen und
 * eine sichtbare Meldung setzen.
 */
export async function leseRumpf<T>(antwort: Response): Promise<T> {
  try {
    return await antwort.json() as T;
  } catch {
    return {} as T;
  }
}
