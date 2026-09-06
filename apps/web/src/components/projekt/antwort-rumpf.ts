// Wirft eine Route einen unbehandelten Fehler, liefert Next eine HTML-Fehlerseite (500);
// antwort.json() scheitert daran und lehnt ab, was ohne catch aus dem void-Klickhandler
// entkommt und die Schaltflaeche wirkungslos macht. Ein leerer Rumpf laesst den Aufrufer
// stattdessen seine Statusauswertung erreichen.
export async function leseRumpf<T>(antwort: Response): Promise<T> {
  try {
    return await antwort.json() as T;
  } catch {
    return {} as T;
  }
}
