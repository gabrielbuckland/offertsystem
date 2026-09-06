// PE-04: Zusammenfuehrung von Ebene 1/2 bewusst NICHT hier, sondern in ProjektEinstellungen
// (nur dort laesst sich die effektive Konfiguration wieder in ein Delta zurueckrechnen).
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
        // Leeres Objekt = Projekt rechnet mit reinen Firmenwerten (projekt-schema.ts).
        delta={projekt.einstellungen ?? {}}
      />
    </main>
  );
}
