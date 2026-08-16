/**
 * Druckansicht: dieselbe Komponente wie die Bildschirmdarstellung, ohne Bedienelemente
 * (AK-2.1). Das Bereitschaftssignal `data-druck-bereit="true"` steht bereits im
 * serverseitig erzeugten Markup und ist deshalb ohne Zeitlimit pruefbar.
 */
import { OfferteDokument } from '@offert/offer';
import { verzeichnisAusLaufzeit } from '../../../../server/laufzeit.js';
import { ladeOfferte } from '../../../../server/offerten-ablage.js';

export const dynamic = 'force-dynamic';

export default async function DruckSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // `ladeOfferte` prueft gegen offerSchema; ein verletzendes Artefakt wird nicht
  // teilweise dargestellt (I-24).
  const offerte = await ladeOfferte(id, verzeichnisAusLaufzeit());
  return <OfferteDokument offerte={offerte} />;
}
