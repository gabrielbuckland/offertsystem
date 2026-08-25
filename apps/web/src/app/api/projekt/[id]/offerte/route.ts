/**
 * Duenner Adapter: Laufzeit holen, `fuehreProjektlauf` fragen, das Ergebnis ablegen.
 *
 * Der zweistufige Rechenweg steht in `server/projekt-lauf.ts` (PE-21) und ist mit der
 * Berechnungsroute geteilt; diese Route unterscheidet sich von jener allein darin, dass
 * sie die fertige Offerte zusaetzlich ABLEGT. Die Ablage geschieht nur im Erfolgsfall:
 * Weder eine Bewertungsluecke noch ein abgebrochenes Honorar erzeugt ein Artefakt (I-24).
 */
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { holeLaufzeit } from '../../../../../server/laufzeit.js';
import { legeOfferteAb } from '../../../../../server/offerten-ablage.js';
import { fuehreProjektlauf } from '../../../../../server/projekt-lauf.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  const laufzeit = holeLaufzeit(); // PE-24: eine Verdrahtung
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { offertenVerzeichnis } = laufzeit.wert;
  const { id } = await kontext.params;

  const lauf = await fuehreProjektlauf(id, laufzeit.wert);
  switch (lauf.art) {
    case 'unvollstaendig':
      return Response.json({ unvollstaendig: true }, { status: 200 });
    case 'bewertungLuecke':
      return Response.json({
        fehler: {
          text: 'Für mindestens einen Wohnungstyp liegt keine Bewertung vor. '
            + 'Es wird keine Offerte erzeugt.',
        },
      }, { status: 422 });
    case 'honorarAbbruch':
      // Anders als die Berechnungsroute, die das Teilergebnis mit 200 ausweist: Ohne
      // Honorarrange gibt es nichts zu offerieren, also entsteht kein Artefakt (I-24).
      return Response.json(
        { fehler: uebersetzeStufenFehler(lauf.fehler) }, { status: 422 });
    case 'fehler':
      // Unveraendert durchgereicht, samt `adressat` und ggf. `feldpfad` (s. Berechnungsroute).
      return Response.json({ fehler: lauf.fehler }, { status: lauf.status });
    case 'offerte':
      await legeOfferteAb(lauf.offerte, offertenVerzeichnis);
      return Response.json({ offertId: lauf.offerte.metadata.offertId }, { status: 201 });
  }
}
