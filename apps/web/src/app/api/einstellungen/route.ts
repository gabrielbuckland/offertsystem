// Schreibpfad der firmenweiten Konfiguration (US-08). Geschrieben wird nur nach bestandener
// Validierung (I-21, zurueckweisen statt melden). Antwortform `befunde` (Pfad + Text) statt
// `fehler.text`: die Editoren verankern ihre Meldung am Feld, nicht am gesamten Formular.
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
