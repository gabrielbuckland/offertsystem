/** Ergebnisseite. Sie laedt das abgelegte Artefakt und stellt es mit Bedienelementen dar. */
import { ErgebnisDarstellung } from '../../../components/ErgebnisDarstellung.js';
import { NichtGefunden } from '../../../components/NichtGefunden.js';
import { verzeichnisAusLaufzeit } from '../../../server/laufzeit.js';
import { ladeOfferte } from '../../../server/offerten-ablage.js';

export const dynamic = 'force-dynamic';

export default async function OffertSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const offerte = await ladeOfferte(id, verzeichnisAusLaufzeit());
    return <ErgebnisDarstellung offerte={offerte} />;
  } catch {
    // Kein Fehlerzustand der Anwendung, sondern eine Auskunft (A-12).
    return <NichtGefunden id={id} />;
  }
}
