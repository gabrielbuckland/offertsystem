/**
 * Schreibweg der PROJEKTBEZOGENEN Ebene (Ebene 2 des Zwei-Ebenen-Modells). Der Rumpf
 * ist das Delta — nur die uebersteuerten Pfade, nicht die ganze Konfiguration.
 *
 * Zurueckweisen statt melden (I-21): Geschrieben wird erst, NACHDEM das Delta mit den
 * Firmenwerten zusammengefuehrt und die zusammengefuehrte Konfiguration durch alle drei
 * Pruefebenen gelaufen ist. Es existiert kein Zeitfenster, in dem ein Projekt mit einer
 * invariantenverletzenden Konfiguration abgelegt waere.
 *
 * Antwortform `befunde` (Pfad + Text) wie bei der firmenweiten Route: Die Editoren
 * verankern ihre Meldung am Feld, nicht am Formular. Dafuer laeuft die Uebersetzung ueber
 * denselben `zuBefunden`-Weg wie firmenweit — ein eigener Weg verankert Befunde sonst
 * pauschal und keine Bereichskarte kann sie zeigen.
 */
import { zuBefunden, type EinstellungsBefund } from '../../../../../server/einstellungen-ablage.js';
import {
  holeLaufzeit, holeProjektLaufzeit, type LaufzeitFehler,
} from '../../../../../server/laufzeit.js';
import { ladeProjekt, speichereProjekt } from '../../../../../server/projekt-ablage.js';

/**
 * Ein Umgebungsfehler traegt keine `fehler`-Liste (siehe `LaufzeitFehler`). Er bekommt
 * deshalb den unanhaengigen Pfad `''` — dieselbe Form, die die Oberflaeche bereits fuer
 * Netz- und Serverfehler kennt und in jeder Bereichskarte zeigt.
 */
function befundeAus(fehlschlag: LaufzeitFehler): readonly EinstellungsBefund[] {
  if (fehlschlag.fehler !== undefined) return zuBefunden(fehlschlag.fehler);
  return fehlschlag.meldungen.map((text) => ({ pfad: '', text }));
}

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(anfrage: Request, kontext: Kontext): Promise<Response> {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { id } = await kontext.params;

  let roh: unknown;
  try {
    roh = await anfrage.json();
  } catch {
    return Response.json(
      { befunde: [{ pfad: '(rumpf)', text: 'Der Anfrageinhalt ist kein gültiges JSON.' }] },
      { status: 422 });
  }
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) {
    return Response.json(
      { befunde: [{ pfad: '(rumpf)', text: 'Die Einstellungen müssen ein Objekt sein.' }] },
      { status: 422 });
  }

  const projekt = await ladeProjekt(id, laufzeit.wert.projekteVerzeichnis).catch(() => null);
  if (projekt === null) {
    return Response.json({ fehler: { text: 'Projekt nicht gefunden.' } }, { status: 404 });
  }

  // Probelauf VOR dem Schreiben: Genau hier faellt ein gesperrter Pfad, ein unbekannter
  // Schluessel oder eine verletzte Invariante auf.
  const geprueft = holeProjektLaufzeit({ einstellungen: roh as Record<string, unknown> });
  if (!geprueft.ok) {
    return Response.json({ befunde: befundeAus(geprueft) }, { status: 422 });
  }

  await speichereProjekt(
    { ...projekt, einstellungen: roh as Record<string, unknown> },
    laufzeit.wert.projekteVerzeichnis,
  );
  return Response.json(
    { pruefsumme: geprueft.wert.fingerabdruck.konfigPruefsumme }, { status: 200 });
}
