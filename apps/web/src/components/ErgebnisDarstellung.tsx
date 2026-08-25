/**
 * Ergebnisdarstellung: dasselbe Offert-Objekt, dieselbe Vorlage, nur um Bedienelemente
 * erweitert. Es gibt keine separate «Detailansicht» mit eigener Datenzusammenstellung —
 * zwei Aufbereitungen koennten auseinanderlaufen, ohne dass ein Test es saehe.
 */
import { OfferteDokument, type Offer } from '@offert/offer';

export function ErgebnisDarstellung({ offerte }: { offerte: Offer }) {
  return (
    <div className="ergebnis">
      <nav className="bedienelement">
        <a href={`/api/offerte/${offerte.metadata.offertId}/pdf`}>Als PDF exportieren</a>
        <a href={`/projekte/${offerte.project.projektId}`}>Zurück zum Projekt</a>
        <a href="/projekte">Übersicht</a>
      </nav>
      <OfferteDokument offerte={offerte} />
    </div>
  );
}
