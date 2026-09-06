// Keine separate "Detailansicht" mit eigener Datenzusammenstellung: zwei Aufbereitungen
// koennten auseinanderlaufen, ohne dass ein Test es saehe.
import type { Offer } from '@offert/offer';
import { OfferteDokument, VermarktungsOfferte } from '@offert/offer/template';
import { buttonVariants } from './ui/button.js';
import { cn } from '../lib/utils.js';

export function ErgebnisDarstellung({ offerte }: { offerte: Offer }) {
  return (
    <div className="ergebnis">
      <nav className="bedienelement">
        <div className="flex items-center gap-3 p-4">
          <a
            href={`/api/offerte/${offerte.metadata.offertId}/pdf`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Als PDF exportieren
          </a>
          <a
            href={`/projekte/${offerte.project.projektId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Zurück zum Projekt
          </a>
          <a href="/projekte" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Übersicht
          </a>
        </div>
      </nav>
      {offerte.dokument === undefined ? (
        // Fehlt `dokument` (aeltere Artefakte ohne Dokumentblock): unveraendert darstellen (I-24).
        <OfferteDokument offerte={offerte} />
      ) : (
        <>
          <VermarktungsOfferte offerte={offerte} />
          <details className="bedienelement">
            <summary>Rechenweg (intern)</summary>
            <OfferteDokument offerte={offerte} />
          </details>
        </>
      )}
    </div>
  );
}
