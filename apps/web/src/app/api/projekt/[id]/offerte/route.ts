// PE-21/I-24: Duenner Adapter; Ablage nur im Erfolgsfall, Luecke/Abbruch erzeugen kein Artefakt.
import {
  validiereGewaehltesHonorar, herkunft, PlatzhalterFehler, loeseDokumentAuf, platzhalterWerte,
} from '@offert/offer';
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { holeLaufzeit, holeProjektLaufzeit } from '../../../../../server/laufzeit.js';
import { legeOfferteAb } from '../../../../../server/offerten-ablage.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';
import { fuehreProjektlauf } from '../../../../../server/projekt-lauf.js';
import { ladeVorlage } from '../../../../../server/vorlagen-ablage.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(anfrage: Request, kontext: Kontext): Promise<Response> {
  // Henne-Ei: Firmenlaufzeit liefert nur den Ablageort, Delta erst aus geladenem Projekt.
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
  // I-21: Laufzeit erst NACH dem Projekt, da effektive Konfiguration am Delta haengt.
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
      // I-24: ohne Honorarrange kein Artefakt.
      return Response.json(
        { fehler: uebersetzeStufenFehler(lauf.fehler) }, { status: 422 });
    case 'fehler':
      return Response.json({ fehler: lauf.fehler }, { status: lauf.status });
    case 'offerte': {
      // I-24: falsches Format erzeugt kein Artefakt. Nur Form (Ganzzahl in Rappen) wird
      // geprueft; Abweichung von der Honorarrange ist erlaubt (Empfehlung, keine Schranke).
      const koerper: unknown = await anfrage.json().catch(() => undefined);
      const honorarPruefung = validiereGewaehltesHonorar(
        (koerper as { readonly gewaehltesHonorar?: unknown } | undefined)?.gewaehltesHonorar,
      );
      if (!honorarPruefung.ok) {
        return Response.json({ fehler: { text: honorarPruefung.text } }, { status: 422 });
      }
      const offerteMitHonorar = {
        ...lauf.offerte,
        aggregates: {
          ...lauf.offerte.aggregates,
          gewaehltesHonorar: herkunft(honorarPruefung.wert, 'marketer-decision'),
        },
      };

      // I-24: unauflösbarer Platzhalter erzeugt kein Artefakt, sondern eine Meldung.
      // I-4: ladeProjekt/ladeVorlage koennen fehlschlagen, sonst unbehandelte 500.
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
          platzhalterWerte(offerteMitHonorar, projekt.auftraggeber === undefined
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
        ...offerteMitHonorar,
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
