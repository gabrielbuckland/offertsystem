// A-12, NFA-11: verstaendliche Meldung statt Fehlerzustand der Anwendung.
export function NichtGefunden({ id }: { id: string }) {
  return (
    <main role="alert">
      <h1>Offerte nicht gefunden</h1>
      <p>
        Die angeforderte Offerte ist nicht vorhanden (Kennung {id}). Möglicherweise wurde
        das zugehörige JSON-Artefakt aus dem Ablageverzeichnis entfernt.
      </p>
      <p><a href="/projekte">Zurück zur Übersicht</a></p>
    </main>
  );
}
