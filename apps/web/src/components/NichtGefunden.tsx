/**
 * Eine geloeschte oder nie erzeugte Offerte fuehrt zu einer verstaendlichen Meldung, nicht
 * zu einem Fehlerzustand der Anwendung (A-12, NFA-11).
 */
export function NichtGefunden({ id }: { id: string }) {
  return (
    <main role="alert">
      <h1>Offerte nicht gefunden</h1>
      <p>
        Die angeforderte Offerte ist nicht vorhanden (Kennung {id}). Möglicherweise wurde
        das zugehörige JSON-Artefakt aus dem Ablageverzeichnis entfernt.
      </p>
      <p><a href="/dashboard">Zurück zur Übersicht</a></p>
    </main>
  );
}
