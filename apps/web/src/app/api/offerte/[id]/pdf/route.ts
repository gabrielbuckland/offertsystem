/**
 * Duenner Adapter (Brief §5.1): laden, drucken, ausliefern. Die Namensbildung steht in
 * `server/pdf-dateiname.ts`, damit sie ohne laufenden Server pruefbar ist — eine
 * `route.ts` darf ausser den Handlern nichts exportieren.
 */
import { druckeOfferte } from '@offert/offer';
import { verzeichnisAusLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeOfferte } from '../../../../../server/offerten-ablage.js';
import { dateiname } from '../../../../../server/pdf-dateiname.js';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verzeichnis = verzeichnisAusLaufzeit();
  const offerte = await ladeOfferte(id, verzeichnis);
  const pdf = await druckeOfferte({
    basisUrl: process.env['APP_BASE_URL'] ?? 'http://localhost:3000',
    offertId: id,
    referenznummer: offerte.metadata.referenznummer,
  });
  return new Response(pdf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${dateiname(offerte.metadata)}"`,
    },
  });
}
