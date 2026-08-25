import { holeLaufzeit } from '../../../server/laufzeit.js';
import { listeProjekte } from '../../../server/projekt-ablage.js';
import { ProjektKacheln } from '../../../components/ProjektKacheln.js';
import { NeuesProjekt } from '../../../components/NeuesProjekt.js';

export const dynamic = 'force-dynamic';

export default async function ProjekteSeite() {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Projekte</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }
  const eintraege = await listeProjekte(laufzeit.wert.projekteVerzeichnis);
  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <NeuesProjekt />
      </div>
      <ProjektKacheln eintraege={eintraege} />
    </main>
  );
}
