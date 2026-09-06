// NFA-12/I-27: Abruf ist eigene, ausdrueckliche Handlung (kontingentiert), kein Nebeneffekt
// des Offerterzeugens. Ohne referenzobjektId laeuft er ueber alle Referenzobjekte, sonst nur das eine.
import type { WohnungstypId } from '@offert/core';
import { beschaffe } from '../../../../../server/eingang.js';
import { holeLaufzeit, holeProjektLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeProjekt, speichereProjekt } from '../../../../../server/projekt-ablage.js';
import { projiziere } from '../../../../../server/projektion.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

async function leseReferenzobjektId(anfrage: Request): Promise<string | undefined> {
  try {
    const rumpf = await anfrage.json() as { readonly referenzobjektId?: unknown };
    return typeof rumpf.referenzobjektId === 'string' ? rumpf.referenzobjektId : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(anfrage: Request, kontext: Kontext): Promise<Response> {
  const referenzobjektId = await leseReferenzobjektId(anfrage);
  // Henne-Ei: Firmenlaufzeit liefert nur den Ablageort, Delta erst aus geladenem Projekt.
  const vorlaufzeit = holeLaufzeit();
  if (!vorlaufzeit.ok) {
    return Response.json({ fehler: { text: vorlaufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { id } = await kontext.params;

  const projekt = await ladeProjekt(id, vorlaufzeit.wert.projekteVerzeichnis).catch(() => null);
  if (projekt === null) {
    return Response.json({ fehler: { text: `Projekt ${id} nicht gefunden.` } }, { status: 404 });
  }
  // I-21: Laufzeit erst NACH dem Projekt, da effektive Konfiguration am Delta haengt.
  const laufzeit = holeProjektLaufzeit(projekt);
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { provider, projekteVerzeichnis } = laufzeit.wert;
  if (projekt.referenzobjekte.length === 0) {
    return Response.json(
      { fehler: { text: 'Es ist kein Referenzobjekt hinterlegt.' } }, { status: 422 });
  }

  let zuBeschaffen = projekt.referenzobjekte;
  if (referenzobjektId !== undefined) {
    const gefunden = projekt.referenzobjekte.find((r) => r.id === referenzobjektId);
    if (gefunden === undefined) {
      return Response.json(
        { fehler: { text: `Referenzobjekt ${referenzobjektId} nicht gefunden.` } }, { status: 404 });
    }
    zuBeschaffen = [gefunden];
  }

  // Ohne ohneAnpassungen versuchte projiziere unnoetig Franken-Positionen ueber leere
  // Basispreise umzurechnen und schluege fehl.
  const projiziert = projiziere(
    { ...projekt, referenzobjekte: zuBeschaffen }, {}, { ohneAnpassungen: true });
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
  // NFA-12/I-27: beschaffe hat bereits Kontingent verbraucht, Schreibfehler darf nicht
  // stillschweigend durchfallen.
  let gespeichert;
  try {
    gespeichert = await speichereProjekt(aktualisiert, projekteVerzeichnis);
  } catch {
    return Response.json({
      fehler: {
        text: 'Die Bewertung wurde bezogen, konnte aber nicht gespeichert werden; '
          + 'dabei wurde Guthaben beim Anbieter verbraucht. Der Abruf muss '
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
