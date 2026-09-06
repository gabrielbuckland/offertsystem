// A-12, NFA-11: Auskunft statt Fehlerzustand, mit HTTP 404 statt Soft-200.
export default function OfferteNichtGefunden() {
  return (
    <main role="alert">
      <h1>Offerte nicht gefunden</h1>
      <p>
        Die angeforderte Offerte ist nicht vorhanden. Möglicherweise wurde das
        zugehörige JSON-Artefakt aus dem Ablageverzeichnis entfernt.
      </p>
      <p><a href="/projekte">Zurück zur Übersicht</a></p>
    </main>
  );
}
