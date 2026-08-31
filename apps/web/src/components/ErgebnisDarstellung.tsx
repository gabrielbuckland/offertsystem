/**
 * Ergebnisdarstellung: dasselbe Offert-Objekt, dieselbe Vorlage, nur um Bedienelemente
 * erweitert. Es gibt keine separate «Detailansicht» mit eigener Datenzusammenstellung —
 * zwei Aufbereitungen koennten auseinanderlaufen, ohne dass ein Test es saehe.
 */
import type { Offer } from '@offert/offer';
import { OfferteDokument, VermarktungsOfferte } from '@offert/offer/template';

export function ErgebnisDarstellung({ offerte }: { offerte: Offer }) {
  return (
    <div className="ergebnis">
      <nav className="bedienelement">
        <a href={`/api/offerte/${offerte.metadata.offertId}/pdf`}>Als PDF exportieren</a>
        <a href={`/projekte/${offerte.project.projektId}`}>Zurück zum Projekt</a>
        <a href="/projekte">Übersicht</a>
      </nav>
      {offerte.dokument === undefined ? (
        // Alt-Artefakt aus der Zeit vor dem Dokumentblock: unverändert darstellen (I-24).
        <OfferteDokument offerte={offerte} />
      ) : (
        <>
          <VermarktungsOfferte offerte={offerte} />
          {/* Rechenweg nur im Tool (Benutzerentscheid 2026-08-27), nicht im Dokument. */}
          <details className="bedienelement">
            <summary>Rechenweg (intern)</summary>
            <OfferteDokument offerte={offerte} />
          </details>
        </>
      )}
    </div>
  );
}
