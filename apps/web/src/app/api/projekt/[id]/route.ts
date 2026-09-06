// Kein GET hier: Detailseite laedt serverseitig ueber ladeProjekt in page.tsx,
// ein zweiter Leseweg schuefe eine zweite Ladequelle.
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
  // I-24: anfrage.json() wirft bei nicht parsierbarem Rumpf, sonst 500 statt 422.
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
