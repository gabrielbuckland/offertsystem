// Der interne Rechenweg nutzt dieselbe Stufenaufbereitung wie die Projektansicht
// (keine zweite Datenzusammenstellung), gespiesen aus dem eingefrorenen Artefakt.
import type { Offer } from '@offert/offer';
import { OfferteDokument, VermarktungsOfferte } from '@offert/offer/template';
import { buttonVariants } from './ui/button.js';
import { cn } from '../lib/utils.js';
import { OffertRechenweg } from './offerte/OffertRechenweg.js';
import { baueOffertRechenweg } from './offerte/rechenweg-offerte-logik.js';

export function ErgebnisDarstellung({ offerte }: { offerte: Offer }) {
  // null nur bei unlesbarer Konfigurationskopie — dann ohne interne Ansicht statt halb.
  const rechenweg = offerte.dokument === undefined ? null : baueOffertRechenweg(offerte);
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
          {rechenweg !== null && (
            <OffertRechenweg stufen={rechenweg.stufen} grundlagen={rechenweg.grundlagen} />
          )}
        </div>
      </nav>
      {offerte.dokument === undefined ? (
        // Fehlt `dokument` (aeltere Artefakte ohne Dokumentblock): unveraendert darstellen (I-24).
        <OfferteDokument offerte={offerte} />
      ) : (
        <VermarktungsOfferte offerte={offerte} />
      )}
    </div>
  );
}
