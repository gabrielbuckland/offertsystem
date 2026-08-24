/**
 * Speichert den Arbeitsstand eines Projekts (Detailseite, entprelltes Autosave ueber
 * `verwendeProjekt`). Kein GET hier: Die Detailseite laedt serverseitig ueber
 * `ladeProjekt` in `page.tsx`, ein zweiter Leseweg schuefe eine zweite Ladequelle.
 */
import { holeLaufzeit } from '../../../../server/laufzeit.js';
import { speichereProjekt } from '../../../../server/projekt-ablage.js';
import { projektSchema } from '../../../../server/projekt-schema.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function PUT(anfrage: Request, kontext: Kontext): Promise<Response> {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { id } = await kontext.params;
  // `anfrage.json()` wirft bei einem nicht parsierbaren Rumpf, BEVOR `safeParse` laeuft.
  // Ohne diesen Fang traege ein abgebrochener oder verstuemmelter Sendevorgang eine 500
  // aus, obwohl er dieselbe Aussage macht wie ein schemawidriger Stand: Der gesendete
  // Projektstand ist ungueltig — das ist ein 422 (I-24).
  let roh: unknown;
  try {
    roh = await anfrage.json();
  } catch {
    return Response.json(
      { fehler: { text: 'Der Projektstand ist ungültig.' } }, { status: 422 });
  }
  const geprueft = projektSchema.safeParse(roh);
  if (!geprueft.success || geprueft.data.id !== id) {
    return Response.json(
      { fehler: { text: 'Der Projektstand ist ungültig.' } }, { status: 422 });
  }
  await speichereProjekt(geprueft.data, laufzeit.wert.projekteVerzeichnis);
  return new Response(null, { status: 204 });
}
