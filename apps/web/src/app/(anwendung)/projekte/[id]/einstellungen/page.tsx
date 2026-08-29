/**
 * Einstiegsseite der projektbezogenen Einstellungen (Ebene 2 des Zwei-Ebenen-Modells).
 *
 * Reine Server-Komponente: Sie holt die beiden Ebenen an ihrer jeweiligen Quelle —
 * Ebene 1 aus `holeLaufzeit()` (dieselbe Rohkonfiguration, aus der auch der
 * Konfigurationsabdruck entsteht, PE-04), Ebene 2 aus dem Projektdatensatz
 * (`projekt.einstellungen`) — und reicht beides an die Client-Komponente durch. Die
 * Zusammenfuehrung geschieht bewusst NICHT hier, sondern in `ProjektEinstellungen`:
 * Nur dort, wo auch bearbeitet wird, laesst sich die effektive Konfiguration wieder in
 * ein Delta zurueckrechnen. Wuerde die Seite bereits die zusammengefuehrte Fassung
 * uebergeben, waeren die Firmenwerte als Vergleichsbasis verloren und jedes Speichern
 * schriebe eine Vollkopie.
 */
import { notFound } from 'next/navigation';
import { ProjektEinstellungen } from '../../../../../components/einstellungen/ProjektEinstellungen.js';
import { Brotkrume } from '../../../../../components/shell/Brotkrume.js';
import { holeLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';

export const dynamic = 'force-dynamic';

interface Props { readonly params: Promise<{ readonly id: string }> }

export default async function ProjektEinstellungenSeite({ params }: Props) {
  const { id } = await params;
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Projekteinstellungen</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }

  const projekt = await ladeProjekt(id, laufzeit.wert.projekteVerzeichnis).catch(() => null);
  if (projekt === null) notFound();

  return (
    <main>
      <Brotkrume stufen={[
        { beschriftung: 'Projekte', href: '/projekte' },
        {
          beschriftung: `${projekt.adresse.strasse} ${projekt.adresse.hausnummer}`,
          href: `/projekte/${projekt.id}`,
        },
        { beschriftung: 'Einstellungen' },
      ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Projekteinstellungen</h1>
      <ProjektEinstellungen
        projektId={projekt.id}
        firmenwerte={laufzeit.wert.rohKonfiguration}
        // Ein Projekt ohne abgelegte Abweichungen rechnet mit den reinen Firmenwerten;
        // das leere Objekt ist genau diese Aussage (`projekt-schema.ts`).
        delta={projekt.einstellungen ?? {}}
      />
    </main>
  );
}
