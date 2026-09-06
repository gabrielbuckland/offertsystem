// US-08/I-21: Schreibpfad der firmenweiten Konfiguration, nur nach bestandener Validierung.
// Antwortform `befunde` statt `fehler.text`: Editoren verankern Meldung am Feld.
import { holeLaufzeit } from '../../../server/laufzeit.js';
import { schreibeCompanyDefaults } from '../../../server/einstellungen-ablage.js';

export async function POST(anfrage: Request): Promise<Response> {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }

  // Ein syntaktisch kaputter Rumpf ist ein Eingabefehler (422), kein Serverfehler.
  let roh: unknown;
  try {
    roh = await anfrage.json();
  } catch {
    return Response.json(
      { fehler: { text: 'Der Anfrageinhalt ist kein gültiges JSON.' } }, { status: 422 });
  }

  const ergebnis = await schreibeCompanyDefaults(roh, laufzeit.wert.umgebung.companyDefaultsPfad);
  if (!ergebnis.ok) {
    return Response.json({ befunde: ergebnis.befunde }, { status: 422 });
  }
  return Response.json({ pruefsumme: ergebnis.pruefsumme }, { status: 200 });
}
