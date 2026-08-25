/** Legt ein Projekt an. Die Kennung entsteht in der Ablage, nicht im Client (E-29). */
import { z } from 'zod';
import { holeLaufzeit } from '../../../server/laufzeit.js';
import { legeProjektAn } from '../../../server/projekt-ablage.js';

const eingabeSchema = z.object({
  strasse: z.string().trim().min(1),
  hausnummer: z.string().trim().min(1),
  plz: z.string().regex(/^\d{4}$/),
  ort: z.string().trim().min(1),
}).strict();

export async function POST(anfrage: Request): Promise<Response> {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  // Ein syntaktisch kaputter Rumpf ist ein Eingabefehler (422), kein Serverfehler —
  // dieselbe Fehlerklasse wie in der PUT-Route, dort bereits behoben
  // (docs/offene-punkte-projektansicht.md).
  let roh: unknown;
  try {
    roh = await anfrage.json();
  } catch {
    return Response.json(
      { fehler: { text: 'Der Anfrageinhalt ist kein gültiges JSON.' } }, { status: 422 });
  }
  const geprueft = eingabeSchema.safeParse(roh);
  if (!geprueft.success) {
    return Response.json(
      { fehler: { text: 'Die Adresse ist unvollständig.' } }, { status: 422 });
  }
  const projekt = await legeProjektAn(
    geprueft.data, laufzeit.wert.projekteVerzeichnis, laufzeit.wert.konfiguration);
  return Response.json({ id: projekt.id }, { status: 201 });
}
