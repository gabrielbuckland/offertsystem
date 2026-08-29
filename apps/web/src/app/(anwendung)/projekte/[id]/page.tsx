import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import type { OffertKonfiguration } from '@offert/core';
import { baueFaktorformular } from '../../../../server/faktorformular.js';
import { holeLaufzeit } from '../../../../server/laufzeit.js';
import { ladeProjekt } from '../../../../server/projekt-ablage.js';
import { listeOfferten } from '../../../../server/offerten-ablage.js';
import { ProjektAnsicht } from '../../../../components/projekt/ProjektAnsicht.js';
import { ProjektOfferten } from '../../../../components/projekt/ProjektOfferten.js';
import { Brotkrume } from '../../../../components/shell/Brotkrume.js';

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
  const { konfiguration, rohKonfiguration } = laufzeit.wert;
  // `listeOfferten` liefert ungefiltert alle Projekte; Filterung liegt beim Aufrufer.
  const alleOfferten = await listeOfferten(laufzeit.wert.offertenVerzeichnis);
  const offerten = alleOfferten.filter((eintrag) => eintrag.projektId === id);
  return (
    <>
      {/* Ausserhalb des <main> von `ProjektAnsicht`: Die Brotkrume traegt den Rueckweg
          auf Projektebene, der Link daneben fuehrt zur projektbezogenen Einstellungsebene
          (Ebene 2) — Ziel-Seite entsteht in einer parallelen Aufgabe (Task 9). */}
      <div className="mb-2 flex items-center justify-between">
        <Brotkrume stufen={[
          { beschriftung: 'Projekte', href: '/projekte' },
          { beschriftung: `${projekt.adresse.strasse} ${projekt.adresse.hausnummer}, `
            + `${projekt.adresse.plz} ${projekt.adresse.ort}` },
        ]}
        />
        <Link
          href={`/projekte/${projekt.id}/einstellungen` as Route}
          className="text-sm text-primary underline"
        >
          Projekteinstellungen
        </Link>
      </div>
      <ProjektAnsicht
        projekt={projekt}
        faktorformular={baueFaktorformular(konfiguration)}
        // Basis der Pipeline-Stufen im Rechenweg-Block; dieselbe Rohkonfiguration, die
        // `rohKonfiguration` in laufzeit.ts bereits fuer den Konfigurationsabdruck (PE-04)
        // durch `unknown` schleust — hier symmetrisch zurueckgeschaerft.
        konfigurationBasis={rohKonfiguration as unknown as OffertKonfiguration}
      />
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Offerten</h2>
        <ProjektOfferten eintraege={offerten} />
      </section>
    </>
  );
}
