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

  // Henne-Ei: Firmenlaufzeit liefert nur den Ablageort; Anzeige/Berechnung laufen
  // danach auf der projektbezogenen Laufzeit, sonst liefen sie mit unterschiedlichen Konfigurationen auseinander.
  const projektLaufzeit = holeProjektLaufzeit(projekt);
  if (!projektLaufzeit.ok) {
    // I-21: Zurueckweisen statt melden gilt auch fuer die Anzeige.
    return <main><h1>Projekt</h1><p>{projektLaufzeit.meldungen.join(' ')}</p></main>;
  }
  const { konfiguration, rohKonfiguration, fingerabdruck } = projektLaufzeit.wert;
  // listeOfferten liefert ungefiltert alle Projekte, Filterung liegt beim Aufrufer.
  const alleOfferten = await listeOfferten(laufzeit.wert.offertenVerzeichnis);
  const offerten = alleOfferten.filter((eintrag) => eintrag.projektId === id);
  return (
    <>
      {/* Ausserhalb des <main> von ProjektAnsicht. */}
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
        // PE-04: dieselbe Rohkonfiguration, symmetrisch zum Konfigurationsabdruck durch unknown geschleust.
        konfigurationBasis={rohKonfiguration as unknown as OffertKonfiguration}
        // A-13: entscheidet je Zeile im Rechenweg ueber «firmenweit» oder «projektbezogen».
        ueberschreibungen={fingerabdruck.ueberschreibungen}
      />
    </>
  );
}
