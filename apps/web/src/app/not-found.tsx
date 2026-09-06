// A-12, NFA-11: deutsche Auskunft statt der englischen Next-Standardseite.
export default function NichtGefunden() {
  return (
    <main role="alert">
      <h1>Seite nicht gefunden</h1>
      <p>Die aufgerufene Adresse führt zu keiner Seite dieser Anwendung.</p>
      <p><a href="/projekte">Zurück zur Übersicht</a></p>
    </main>
  );
}
