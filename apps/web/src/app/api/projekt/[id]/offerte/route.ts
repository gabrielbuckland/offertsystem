/**
 * Duenner Adapter: Laufzeit holen, `fuehreProjektlauf` fragen, das Ergebnis ablegen.
 *
 * Der zweistufige Rechenweg steht in `server/projekt-lauf.ts` (PE-21) und ist mit der
 * Berechnungsroute geteilt; diese Route unterscheidet sich von jener allein darin, dass
 * sie die fertige Offerte zusaetzlich ABLEGT. Die Ablage geschieht nur im Erfolgsfall:
 * Weder eine Bewertungsluecke noch ein abgebrochenes Honorar erzeugt ein Artefakt (I-24).
 */
import { PlatzhalterFehler, loeseDokumentAuf } from '@offert/offer/src/vorlage/aufloesung.js';
import { platzhalterWerte } from '@offert/offer/src/vorlage/platzhalter.js';
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { holeLaufzeit } from '../../../../../server/laufzeit.js';
import { legeOfferteAb } from '../../../../../server/offerten-ablage.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';
import { fuehreProjektlauf } from '../../../../../server/projekt-lauf.js';
import { ladeVorlage } from '../../../../../server/vorlagen-ablage.js';

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
    case 'offerte': {
      // Platzhalter-Auflösung beim Finalisieren (Spec 2026-08-27 §2): Das Artefakt
      // trägt den aufgelösten Text; ein unauflösbarer Platzhalter erzeugt KEIN
      // Artefakt (I-24), sondern eine benannte Meldung an den Vermarkter.
      const projekt = await ladeProjekt(id, laufzeit.wert.projekteVerzeichnis);
      const vorlage = await ladeVorlage(laufzeit.wert.umgebung.offertVorlagePfad);
      const inhalt = projekt.offertText ?? vorlage.inhalt;
      let aufgeloest;
      try {
        aufgeloest = loeseDokumentAuf(
          inhalt,
          platzhalterWerte(lauf.offerte, projekt.auftraggeber === undefined
            ? {} : { auftraggeber: projekt.auftraggeber }),
        );
      } catch (fehler) {
        if (fehler instanceof PlatzhalterFehler) {
          return Response.json({ fehler: {
            text: fehler.grund === 'fehlt' && fehler.id === 'auftraggeber'
              ? 'Der Offerttext verwendet den Platzhalter «auftraggeber», im Projekt '
                + 'ist aber kein Auftraggeber erfasst (Basisinformationen).'
              : fehler.message,
          } }, { status: 422 });
        }
        throw fehler;
      }
      const offerte = {
        ...lauf.offerte,
        dokument: {
          inhalt: aufgeloest,
          vorlageVersion: vorlage.version,
          ...(projekt.auftraggeber === undefined ? {}
            : { auftraggeber: projekt.auftraggeber }),
        },
      };
      await legeOfferteAb(offerte, offertenVerzeichnis);
      return Response.json({ offertId: offerte.metadata.offertId }, { status: 201 });
    }
  }
}
