// Duenner Adapter (Brief §5.1): laden, drucken, ausliefern.
import { druckeOfferte } from '@offert/offer/src/pdf/drucke-offerte.js';
import { verzeichnisAusLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeOfferte } from '../../../../../server/offerten-ablage.js';
import { dateiname } from '../../../../../server/pdf-dateiname.js';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verzeichnis = verzeichnisAusLaufzeit();
  let offerte;
  try {
    offerte = await ladeOfferte(id, verzeichnis);
  } catch {
    // Kein leeres PDF: Der Nichtfund wird als Text beantwortet (A-12, I-24).
    return new Response(
      `Die angeforderte Offerte ist nicht vorhanden (Kennung ${id}).`,
      { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }
  const adresse = `${offerte.property.adresse.strasse} ${offerte.property.adresse.hausnummer}, `
    + `${offerte.property.adresse.plz} ${offerte.property.adresse.ort}`;
  const pdf = await druckeOfferte({
    basisUrl: process.env['APP_BASE_URL'] ?? 'http://localhost:3000',
    offertId: id,
    adresse,
    erstelltAm: offerte.metadata.erstelltAm,
  });
  return new Response(pdf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${dateiname(offerte.metadata)}"`,
    },
  });
}
