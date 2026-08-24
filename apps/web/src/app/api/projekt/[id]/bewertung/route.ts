/**
 * Bezieht die Referenzbewertungen je Wohnungstyp und haelt sie im Projekt fest.
 *
 * Der Abruf ist eine eigene, ausdrueckliche Handlung und kein Nebeneffekt des
 * Offerterzeugens: Die Abrufzahl ist kontingentiert (NFA-12, I-27), und der Vermarkter
 * muss sehen, wann Credits verbraucht werden.
 */
import type { WohnungstypId } from '@offert/core';
import { beschaffe } from '../../../../../server/eingang.js';
import { holeLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeProjekt, speichereProjekt } from '../../../../../server/projekt-ablage.js';
import { projiziere } from '../../../../../server/projektion.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { provider, projekteVerzeichnis } = laufzeit.wert;
  const { id } = await kontext.params;

  const projekt = await ladeProjekt(id, projekteVerzeichnis).catch(() => null);
  if (projekt === null) {
    return Response.json({ fehler: { text: `Projekt ${id} nicht gefunden.` } }, { status: 404 });
  }
  if (projekt.referenzobjekte.length === 0) {
    return Response.json(
      { fehler: { text: 'Es ist kein Referenzobjekt hinterlegt.' } }, { status: 422 });
  }

  // Reiner Bewertungsabruf braucht keine Anpassungen; ohne die Option versuchte
  // `projiziere` unnoetig, in Franken erfasste Positionen ueber leere Basispreise
  // umzurechnen und schluege dabei fehl (siehe Berechnungsroute).
  const projiziert = projiziere(projekt, {}, { ohneAnpassungen: true });
  if (!projiziert.ok) {
    return Response.json({ fehler: { text: projiziert.meldung } }, { status: 422 });
  }
  const beschafft = await beschaffe(projiziert.wert, provider);
  if (!beschafft.ok) {
    return Response.json({ fehler: { text: beschafft.meldung } }, { status: 502 });
  }

  const buendel = beschafft.wert.buendel;
  const aktualisiert = {
    ...projekt,
    referenzobjekte: projekt.referenzobjekte.map((r) => {
      const bewertung = buendel.bewertungen.get(r.id as WohnungstypId);
      return bewertung === undefined ? r : {
        ...r,
        bewertung: {
          wert: bewertung.marktwert,
          bewertungsdatum: bewertung.bewertungsdatum,
          konfidenzklasse: bewertung.anzeige.konfidenzklasse,
        },
      };
    }),
  };
  // `beschaffe` hat bereits Provider-Kontingent verbraucht (NFA-12, I-27): Ein
  // Schreibfehler hier darf nicht stillschweigend durchfallen, sonst erfaehrt der
  // Vermarkter nicht, dass Credits verbraucht wurden, ohne dass etwas festgehalten ist.
  let gespeichert;
  try {
    gespeichert = await speichereProjekt(aktualisiert, projekteVerzeichnis);
  } catch {
    return Response.json({
      fehler: {
        text: 'Die Bewertung wurde bezogen — dabei wurde Guthaben beim Anbieter '
          + 'verbraucht —, konnte aber nicht gespeichert werden. Der Abruf muss '
          + 'wiederholt werden.',
      },
    }, { status: 500 });
  }

  return Response.json({
    projekt: gespeichert,
    vollstaendig: buendel.vollstaendig,
    fehlgeschlagenerTyp: buendel.vollstaendig ? undefined : buendel.fehlgeschlagenerTyp,
  }, { status: 200 });
}
