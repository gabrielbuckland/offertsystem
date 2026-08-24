/**
 * Duenner Adapter: laden, projizieren, beschaffen, rechnen lassen, uebersetzen. Er rechnet
 * nicht und formatiert nicht.
 *
 * Zweistufig, weil in Franken erfasste Zu-/Abschlaege den ungerundeten Basispreis
 * brauchen (PE-21) und dieser erst aus einem Lauf OHNE Anpassungen hervorgeht. Ein
 * einstufiger Weg setzte zwei Darstellungsformen im Kern voraus — das schliesst E-09 aus.
 *
 * Es entsteht KEIN Artefakt: Diese Route beantwortet nur, sie legt nichts ab.
 */
import { berechne } from '@offert/core';
import { beschaffe, zuEingangsArgumenten } from '../../../../../server/eingang.js';
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { holeLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';
import { projiziere } from '../../../../../server/projektion.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  const laufzeit = holeLaufzeit(); // PE-24: eine Verdrahtung
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { konfiguration, provider, projekteVerzeichnis } = laufzeit.wert;
  const { id } = await kontext.params;

  const projekt = await ladeProjekt(id, projekteVerzeichnis).catch(() => null);
  if (projekt === null) {
    return Response.json({ fehler: { text: `Projekt ${id} nicht gefunden.` } }, { status: 404 });
  }
  if (projekt.referenzobjekte.length === 0 || projekt.einheiten.length === 0) {
    return Response.json({ unvollstaendig: true }, { status: 200 });
  }

  // Erster Lauf ohne Anpassungen: liefert die Basispreise fuer die Umrechnung.
  const ohne = projiziere(projekt, {});
  if (!ohne.ok) {
    return Response.json({ fehler: { text: ohne.meldung } }, { status: 422 });
  }
  const beschafft = await beschaffe(ohne.wert, provider);
  if (!beschafft.ok) {
    return Response.json({ fehler: { text: beschafft.meldung } }, { status: 502 });
  }
  if (!beschafft.wert.buendel.vollstaendig) {
    return Response.json({
      fehler: {
        text: 'Für mindestens einen Wohnungstyp liegt keine Bewertung vor. '
          + 'Es werden keine Preise ausgewiesen.',
      },
    }, { status: 422 });
  }

  const zeitpunkt = new Date().toISOString(); // E-29: Zeit entsteht hier, nie im Kern
  const basisEingang = zuEingangsArgumenten(
    ohne.wert, beschafft.wert, konfiguration, zeitpunkt, { ohneAnpassungen: true });
  if (!basisEingang.ok) {
    return Response.json({ fehler: { text: basisEingang.meldung } }, { status: 422 });
  }
  const basisLauf = berechne(basisEingang.wert);
  if (!basisLauf.ok) {
    return Response.json({ fehler: uebersetzeStufenFehler(basisLauf.fehler) }, { status: 422 });
  }

  const basispreise: Record<string, number> = {};
  for (const position of basisLauf.wert.verkaufssumme.positionen) {
    const einheit = projekt.einheiten.find((e) => e.wohnungsnummer === position.wohnungsnummer);
    if (einheit !== undefined) basispreise[einheit.id] = position.basispreis;
  }

  // Zweiter Lauf, jetzt mit umgerechneten Anpassungen.
  const voll = projiziere(projekt, basispreise);
  if (!voll.ok) {
    return Response.json({ fehler: { text: voll.meldung } }, { status: 422 });
  }
  const eingang = zuEingangsArgumenten(voll.wert, beschafft.wert, konfiguration, zeitpunkt);
  if (!eingang.ok) {
    return Response.json({ fehler: { text: eingang.meldung } }, { status: 422 });
  }
  const ergebnis = berechne(eingang.wert);
  if (!ergebnis.ok) {
    return Response.json({ fehler: uebersetzeStufenFehler(ergebnis.fehler) }, { status: 422 });
  }

  const nachNummer = new Map(projekt.einheiten.map((e) => [e.wohnungsnummer, e.id]));
  return Response.json({
    einheiten: ergebnis.wert.verkaufssumme.positionen.map((p) => ({
      id: nachNummer.get(p.wohnungsnummer) ?? p.wohnungsnummer,
      wohnungsnummer: p.wohnungsnummer,
      basispreis: p.basispreis,
      preis: p.preis,
    })),
    verkaufssumme: ergebnis.wert.verkaufssumme.verkaufssumme,
    honorarMin: ergebnis.wert.honorar.honorarMin,
    honorarMax: ergebnis.wert.honorar.honorarMax,
  }, { status: 200 });
}
