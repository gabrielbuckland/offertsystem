/**
 * Bezieht die Referenzbewertungen je Wohnungstyp und haelt sie im Projekt fest.
 *
 * Der Abruf ist eine eigene, ausdrueckliche Handlung und kein Nebeneffekt des
 * Offerterzeugens: Die Abrufzahl ist kontingentiert (NFA-12, I-27), und der Vermarkter
 * muss sehen, wann Credits verbraucht werden.
 *
 * Ohne Koerper (oder ohne `referenzobjektId` darin) laeuft der Abruf ueber alle
 * Referenzobjekte; mit `referenzobjektId` nur ueber das eine. Die uebrigen
 * Referenzobjekte bleiben in der Antwort unveraendert, da `buendel.bewertungen` dann
 * nur den einen Eintrag enthaelt.
 */
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
    return undefined; // Kein/kein gueltiger Koerper: voller Abruf ueber alle Typen.
  }
}

export async function POST(anfrage: Request, kontext: Kontext): Promise<Response> {
  const referenzobjektId = await leseReferenzobjektId(anfrage);
  // Henne-Ei: Die Firmenlaufzeit liefert nur den Ablageort, das Projekt-Delta erst aus
  // dem geladenen Projekt — daher zwei Aufrufe. Der Datei-Zwischenspeicher des Laders
  // traegt die Kosten des zweiten.
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

  // Reiner Bewertungsabruf braucht keine Anpassungen; ohne die Option versuchte
  // `projiziere` unnoetig, in Franken erfasste Positionen ueber leere Basispreise
  // umzurechnen und schluege dabei fehl.
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
  // `beschaffe` hat bereits Provider-Kontingent verbraucht (NFA-12, I-27): Ein
  // Schreibfehler hier darf nicht stillschweigend durchfallen, sonst erfaehrt der
  // Vermarkter nicht, dass Credits verbraucht wurden, ohne dass etwas festgehalten ist.
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
