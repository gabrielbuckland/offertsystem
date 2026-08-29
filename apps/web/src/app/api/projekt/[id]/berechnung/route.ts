/**
 * Duenner Adapter: Laufzeit holen, `fuehreProjektlauf` fragen, das Ergebnis in eine
 * Antwort uebersetzen. Er rechnet nicht und formatiert nicht.
 *
 * Der zweistufige Rechenweg (PE-21) steht in `server/projekt-lauf.ts` und ist mit der
 * Offert-Route geteilt; diese Route erzeugt nur kein Artefakt, sondern antwortet.
 */
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { holeLaufzeit, holeProjektLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';
import { fuehreProjektlauf } from '../../../../../server/projekt-lauf.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  // Henne-Ei: Das Projektverzeichnis kommt erst aus der firmenweiten Laufzeit, das
  // Projekt-Delta fuer die Berechnung erst aus dem geladenen Projekt — daher zwei
  // Aufrufe (`holeLaufzeit`/`holeProjektLaufzeit`) statt einem.
  const vorlaufzeit = holeLaufzeit();
  if (!vorlaufzeit.ok) {
    return Response.json({ fehler: { text: vorlaufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { id } = await kontext.params;

  const projekt = await ladeProjekt(id, vorlaufzeit.wert.projekteVerzeichnis).catch(() => null);
  if (projekt === null) {
    return Response.json({ fehler: { text: `Projekt ${id} nicht gefunden.` } }, { status: 404 });
  }
  // Laufzeit erst NACH dem Projekt: Die effektive Konfiguration haengt am Delta des
  // Projekts (Ebene 2). Ein invariantenverletzendes Delta faellt hier als 500 mit
  // Codeliste auf, bevor gerechnet wird (I-21).
  const laufzeit = holeProjektLaufzeit(projekt);
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }

  const lauf = await fuehreProjektlauf(id, laufzeit.wert);
  switch (lauf.art) {
    case 'unvollstaendig':
      return Response.json({ unvollstaendig: true }, { status: 200 });
    case 'bewertungLuecke':
      return Response.json({
        fehler: {
          text: 'Für mindestens einen Wohnungstyp liegt keine Bewertung vor. '
            + 'Es werden keine Preise ausgewiesen.',
        },
      }, { status: 422 });
    case 'honorarAbbruch':
      // Status 200: Eine Konfigurationsluecke oberhalb der obersten Stuetzstelle ist kein
      // Eingabefehler. Wohnungspreise und Aufwandindikator bleiben gueltig (E-04); nur an
      // der Stelle der Honorarrange steht eine Meldung statt einer Zahl.
      return Response.json({
        honorarAbbruch: {
          ...lauf.teilergebnis,
          meldung: uebersetzeStufenFehler(lauf.fehler).text,
        },
      }, { status: 200 });
    case 'fehler':
      // Unveraendert durchgereicht: Ein Stufenfehler traegt neben dem Text auch
      // `adressat` (Vermarkter oder Auftraggeber) und ggf. `feldpfad`. Beides gehoert
      // zur Antwort — die Anzeige richtet sich danach.
      return Response.json({ fehler: lauf.fehler }, { status: lauf.status });
    case 'offerte': {
      const o = lauf.offerte;
      return Response.json({
        einheiten: o.derivation.units.map((u) => ({
          id: lauf.einheitenIds.get(u.unitNumber) ?? u.unitNumber,
          wohnungsnummer: u.unitNumber,
          basispreis: u.basePrice.value,
          preis: u.unitPrice.value,
        })),
        verkaufssumme: o.aggregates.totalSalesValue.value,
        honorarMin: o.aggregates.feeRange.value.min,
        honorarMax: o.aggregates.feeRange.value.max,
        herleitung: { derivation: o.derivation, aggregates: o.aggregates },
        // Weist den PROJEKTBEZOGENEN Konfigurationsstand aus (Ebene 2), nicht den
        // Firmenstand — massgeblich fuer den Nachvollzug, mit welchem Delta gerechnet wurde.
        metadaten: { konfigPruefsumme: o.metadata.konfigPruefsumme },
      }, { status: 200 });
    }
  }
}
