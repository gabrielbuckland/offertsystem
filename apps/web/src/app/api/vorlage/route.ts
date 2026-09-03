/**
 * Lese- und Schreibpfad der Offerttext-Vorlage. Antwortformen wie /api/einstellungen:
 * 422 mit `befunde` (Pfad + Text), damit der Editor Meldungen am Feld verankern kann.
 */
import { holeLaufzeit } from '../../../server/laufzeit.js';
import { ladeVorlage, schreibeVorlage } from '../../../server/vorlagen-ablage.js';

export async function GET(): Promise<Response> {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  // I-4: `ladeVorlage` liefert ein `Ergebnis` statt zu werfen, defektes Artefakt wird
  // so zu einer benannten 500-Meldung.
  const vorlage = await ladeVorlage(laufzeit.wert.umgebung.offertVorlagePfad);
  if (!vorlage.ok) {
    return Response.json({ fehler: { text: vorlage.meldung } }, { status: 500 });
  }
  return Response.json(vorlage.wert);
}

export async function POST(anfrage: Request): Promise<Response> {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  let roh: unknown;
  try {
    roh = await anfrage.json();
  } catch {
    return Response.json(
      { fehler: { text: 'Der Anfrageinhalt ist kein gültiges JSON.' } }, { status: 422 });
  }
  const ergebnis = await schreibeVorlage(roh, laufzeit.wert.umgebung.offertVorlagePfad);
  if (!ergebnis.ok) return Response.json({ befunde: ergebnis.befunde }, { status: 422 });
  return Response.json({}, { status: 200 });
}
