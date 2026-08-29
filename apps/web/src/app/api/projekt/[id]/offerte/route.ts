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
import { holeLaufzeit, holeProjektLaufzeit } from '../../../../../server/laufzeit.js';
import { legeOfferteAb } from '../../../../../server/offerten-ablage.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';
import { fuehreProjektlauf } from '../../../../../server/projekt-lauf.js';
import { ladeVorlage } from '../../../../../server/vorlagen-ablage.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  // Henne-Ei: siehe Berechnungsroute.
  const vorlaufzeit = holeLaufzeit();
  if (!vorlaufzeit.ok) {
    return Response.json({ fehler: { text: vorlaufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { id } = await kontext.params;

  const vorabProjekt = await ladeProjekt(id, vorlaufzeit.wert.projekteVerzeichnis)
    .catch(() => null);
  if (vorabProjekt === null) {
    return Response.json({ fehler: { text: `Projekt ${id} nicht gefunden.` } }, { status: 404 });
  }
  // Laufzeit erst NACH dem Projekt: Die effektive Konfiguration haengt am Delta des
  // Projekts (Ebene 2). Ein invariantenverletzendes Delta faellt hier als 500 mit
  // Codeliste auf, bevor gerechnet wird (I-21).
  const laufzeit = holeProjektLaufzeit(vorabProjekt);
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { offertenVerzeichnis } = laufzeit.wert;

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
      // Platzhalter-Auflösung beim Finalisieren: ein unauflösbarer Platzhalter erzeugt
      // KEIN Artefakt (I-24), sondern eine benannte Meldung an den Vermarkter.
      //
      // I-4: `ladeProjekt` und `ladeVorlage` koennen beide fehlschlagen; ohne diesen Fang
      // traege das eine unbehandelte 500 statt einer benannten Meldung.
      let projekt;
      try {
        projekt = await ladeProjekt(id, laufzeit.wert.projekteVerzeichnis);
      } catch {
        return Response.json({
          fehler: { text: `Projekt ${id} nicht gefunden.` },
        }, { status: 404 });
      }
      const vorlage = await ladeVorlage(laufzeit.wert.umgebung.offertVorlagePfad);
      if (!vorlage.ok) {
        return Response.json({
          fehler: { text: `Die Offerttext-Vorlage ist beschädigt (${vorlage.meldung}).` },
        }, { status: 500 });
      }
      const inhalt = projekt.offertText ?? vorlage.wert.inhalt;
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
          vorlageVersion: vorlage.wert.version,
          ...(projekt.auftraggeber === undefined ? {}
            : { auftraggeber: projekt.auftraggeber }),
        },
      };
      await legeOfferteAb(offerte, offertenVerzeichnis);
      return Response.json({ offertId: offerte.metadata.offertId }, { status: 201 });
    }
  }
}
