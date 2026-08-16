/**
 * US-15 und NFA-10: Ein Teilergebnis wird ausgewiesen, nicht stillschweigend ergaenzt und
 * nicht stillschweigend verworfen. Die Kennzeichnung sitzt hier und nicht nur in der
 * Erfassungsmaske, weil das Buendel auch beim erneuten Aufruf der Ergebnisseite
 * unvollstaendig bleibt. Aus einem unvollstaendigen Buendel entsteht keine Offerte (I-24);
 * die Komponente zeigt deshalb kein Ergebnis, sondern den Grund und den naechsten Schritt.
 */
import type { BewertungsBuendel } from '@offert/core';

export function TeilergebnisHinweis({ buendel }: { buendel: BewertungsBuendel }) {
  if (buendel.vollstaendig) return null;
  return (
    <section className="teilergebnis" role="alert">
      <h3>Unvollständiges Bewertungsergebnis</h3>
      <p>
        Für den Wohnungstyp {buendel.fehlgeschlagenerTyp} liegt keine Referenzbewertung
        vor. Ohne vollständiges Bewertungsergebnis wird die Berechnung nicht ausgeführt.
      </p>
      <p>Es wurde keine Offerte erzeugt.</p>
      <p className="bedienelement">
        <a href="/erfassung">Bewertungsabruf wiederholen</a>
      </p>
    </section>
  );
}
