/**
 * Duenner Adapter: laden, projizieren, beschaffen, rechnen lassen, dann ablegen.
 *
 * Zweistufig wie in `berechnung/route.ts` (PE-21): Ein in Franken erfasster Zu-/Abschlag
 * braucht den ungerundeten Basispreis, der erst aus einem Lauf OHNE Anpassungen
 * hervorgeht. Anders als jene Route entsteht hier zusaetzlich ein Artefakt — und zwar
 * erst nach dem vollstaendigen, erfolgreichen zweiten Lauf: Im Fehlerfall entsteht kein
 * Artefakt (I-24).
 */
import { berechne, serialisiereEingang } from '@offert/core';
// Modulpfad statt Paketindex: Der Index re-exportiert auch die React-Komponenten
// (.tsx). Node leistet fuer JSX kein Type-Stripping (PE-09), und dieser Pfad wird
// von `tools/beispiel-offerte.ts` unter Node ausgefuehrt. Es bleibt ein Paketimport.
import { baueOfferte } from '@offert/offer/src/model/baue-offerte.js';
import { beschaffe, zuEingangsArgumenten } from '../../../../../server/eingang.js';
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { erzeugeLaufmetadaten } from '../../../../../server/laufmetadaten.js';
import { holeLaufzeit } from '../../../../../server/laufzeit.js';
import { legeOfferteAb } from '../../../../../server/offerten-ablage.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';
import { projiziere } from '../../../../../server/projektion.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  const laufzeit = holeLaufzeit(); // PE-24: eine Verdrahtung
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { konfiguration, fingerabdruck, provider, projekteVerzeichnis, offertenVerzeichnis }
    = laufzeit.wert;
  const { id } = await kontext.params;

  const projekt = await ladeProjekt(id, projekteVerzeichnis).catch(() => null);
  if (projekt === null) {
    return Response.json({ fehler: { text: `Projekt ${id} nicht gefunden.` } }, { status: 404 });
  }
  if (projekt.referenzobjekte.length === 0 || projekt.einheiten.length === 0) {
    return Response.json({ unvollstaendig: true }, { status: 200 });
  }

  // Erster Lauf ohne Anpassungen: liefert die Basispreise fuer die Umrechnung. Die
  // Option ist noetig, nicht nur beabsichtigt — ohne sie versuchte `projiziere` schon
  // hier, in Franken erfasste Positionen ueber die (noch leeren) Basispreise
  // umzurechnen, und schluege fehl, bevor der Lauf sie ermitteln konnte.
  const ohne = projiziere(projekt, {}, { ohneAnpassungen: true });
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
          + 'Es wird keine Offerte erzeugt.',
      },
    }, { status: 422 });
  }

  const meta = erzeugeLaufmetadaten(fingerabdruck); // PE-04, E-29: Zeit entsteht hier
  const basisEingang = zuEingangsArgumenten(
    ohne.wert, beschafft.wert, konfiguration, meta.erstelltAm, { ohneAnpassungen: true });
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
  const eingang = zuEingangsArgumenten(voll.wert, beschafft.wert, konfiguration, meta.erstelltAm);
  if (!eingang.ok) {
    return Response.json({ fehler: { text: eingang.meldung } }, { status: 422 });
  }
  const ergebnis = berechne(eingang.wert);
  if (!ergebnis.ok) {
    return Response.json({ fehler: uebersetzeStufenFehler(ergebnis.fehler) }, { status: 422 });
  }

  const offerte = baueOfferte({
    ergebnis: ergebnis.wert,
    liegenschaft: eingang.wert.liegenschaft,
    projekt: voll.wert.projekt,
    meta: {
      offertId: meta.offertId,
      erstelltAm: meta.erstelltAm,
      konfigVersion: meta.konfigVersion,
      konfigPruefsumme: meta.konfigPruefsumme,
      // PE-08: der serialisierte EINGANG, nicht die Formulardaten
      berechnungsEingabe: serialisiereEingang(eingang.wert) as Record<string, unknown>,
    },
  });
  await legeOfferteAb(offerte, offertenVerzeichnis);
  return Response.json({ offertId: offerte.metadata.offertId }, { status: 201 });
}
