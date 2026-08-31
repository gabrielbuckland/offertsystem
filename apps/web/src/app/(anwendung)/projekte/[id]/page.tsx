import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import type { OffertKonfiguration } from '@offert/core';
import { baueFaktorformular } from '../../../../server/faktorformular.js';
import { holeLaufzeit, holeProjektLaufzeit } from '../../../../server/laufzeit.js';
import { ladeProjekt } from '../../../../server/projekt-ablage.js';
import { listeOfferten } from '../../../../server/offerten-ablage.js';
import { ProjektAnsicht } from '../../../../components/projekt/ProjektAnsicht.js';
import { OffertenSchaltflaeche } from '../../../../components/projekt/OffertenSchaltflaeche.js';
import { Brotkrume } from '../../../../components/shell/Brotkrume.js';
import { buttonVariants } from '../../../../components/ui/button.js';
import { cn } from '../../../../lib/utils.js';

export const dynamic = 'force-dynamic';

interface Props { readonly params: Promise<{ readonly id: string }> }

export default async function ProjektSeite({ params }: Props) {
  const { id } = await params;
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Projekt</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }
  const projekt = await ladeProjekt(id, laufzeit.wert.projekteVerzeichnis).catch(() => null);
  if (projekt === null) notFound();

  /**
   * Henne-Ei-Muster wie in den drei rechnenden Routen: Die Firmenlaufzeit liefert nur
   * den Ablageort, aus dem das Projekt geladen wird; ANGEZEIGT und GERECHNET wird
   * danach auf der projektbezogenen Laufzeit. Ohne diesen zweiten Schritt baute die
   * Seite Faktorformular, Dossier-Vorbelegung und Rechenweg aus den Firmenwerten,
   * waehrend `POST /berechnung` mit dem Delta rechnete — Anzeige und Rechnung liefen
   * auseinander (K-2).
   */
  const projektLaufzeit = holeProjektLaufzeit(projekt);
  if (!projektLaufzeit.ok) {
    // Zurueckweisen statt melden (I-21) gilt auch fuer die Anzeige: Ein Projekt mit
    // invariantenverletzendem Delta bekommt kein Formular, das so tut, als liesse sich
    // damit rechnen.
    return <main><h1>Projekt</h1><p>{projektLaufzeit.meldungen.join(' ')}</p></main>;
  }
  const { konfiguration, rohKonfiguration, fingerabdruck } = projektLaufzeit.wert;
  // Filterung auf dieses Projekt liegt beim Aufrufer (Task 11, Schnittstellenvorgabe) —
  // `listeOfferten` liefert ungefiltert alle Projekte.
  const alleOfferten = await listeOfferten(laufzeit.wert.offertenVerzeichnis);
  const offerten = alleOfferten.filter((eintrag) => eintrag.projektId === id);
  return (
    <>
      {/* Ausserhalb des <main> von `ProjektAnsicht`: Die Brotkrume traegt den Rueckweg
          auf Projektebene, der Link daneben fuehrt zur projektbezogenen Einstellungsebene
          (Ebene 2, `projekte/[id]/einstellungen/page.tsx`). */}
      <div className="mb-2 flex items-center justify-between">
        <Brotkrume stufen={[
          { beschriftung: 'Projekte', href: '/projekte' },
          { beschriftung: `${projekt.adresse.strasse} ${projekt.adresse.hausnummer}, `
            + `${projekt.adresse.plz} ${projekt.adresse.ort}` },
        ]}
        />
        <div className="flex items-center gap-2">
          <OffertenSchaltflaeche eintraege={offerten} />
          <Link
            href={`/projekte/${projekt.id}/einstellungen` as Route}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Projekteinstellungen
          </Link>
        </div>
      </div>
      <ProjektAnsicht
        projekt={projekt}
        faktorformular={baueFaktorformular(konfiguration)}
        // Basis der Pipeline-Stufen im Rechenweg-Block (Task 9/7); dieselbe Rohkonfiguration,
        // aus der `rohKonfiguration` in laufzeit.ts bereits fuer den Konfigurationsabdruck
        // (PE-04) durch `unknown` geschleust wird — hier symmetrisch zurueckgeschaerft.
        konfigurationBasis={rohKonfiguration as unknown as OffertKonfiguration}
        // Das Ueberschreibungsprotokoll aus derselben Laufzeit: Es entscheidet im
        // Rechenweg je Zeile ueber «firmenweit» oder «projektbezogen» (A-13).
        ueberschreibungen={fingerabdruck.ueberschreibungen}
      />
    </>
  );
}
