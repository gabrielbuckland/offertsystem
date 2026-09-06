// AK-2.1: data-druck-bereit="true" steht bereits im serverseitig erzeugten Markup,
// deshalb ohne Zeitlimit pruefbar.
import { OfferteDokument, VermarktungsOfferte } from '@offert/offer/template';
import { verzeichnisAusLaufzeit } from '../../../../server/laufzeit.js';
import { ladeOfferte } from '../../../../server/offerten-ablage.js';

export const dynamic = 'force-dynamic';

export default async function DruckSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // I-24: ladeOfferte prueft gegen offerSchema, ein verletzendes Artefakt wird nicht teilweise dargestellt.
  const offerte = await ladeOfferte(id, verzeichnisAusLaufzeit());
  return offerte.dokument === undefined
    ? <OfferteDokument offerte={offerte} />
    : <VermarktungsOfferte offerte={offerte} />;
}
