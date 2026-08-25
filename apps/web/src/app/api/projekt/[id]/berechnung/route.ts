/**
 * Duenner Adapter: Laufzeit holen, `fuehreProjektlauf` fragen, das Ergebnis in eine
 * Antwort uebersetzen. Er rechnet nicht und formatiert nicht.
 *
 * Der zweistufige Rechenweg selbst steht in `server/projekt-lauf.ts` (PE-21) — er ist
 * mit der Offert-Route geteilt. Diese Route unterscheidet sich von jener nur noch darin,
 * was sie mit dem Ergebnis tut: Es entsteht KEIN Artefakt. Sie antwortet nur.
 *
 * Die Antwort reicht die Herleitung des Offert-Schemas durch (`derivation`/`aggregates`),
 * statt ein zweites Datenbild derselben Zahlen aufzubauen.
 */
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { holeLaufzeit } from '../../../../../server/laufzeit.js';
import { fuehreProjektlauf } from '../../../../../server/projekt-lauf.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  const laufzeit = holeLaufzeit(); // PE-24: eine Verdrahtung
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { id } = await kontext.params;

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
      }, { status: 200 });
    }
  }
}
