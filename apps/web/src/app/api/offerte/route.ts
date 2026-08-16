/**
 * Duenner Adapter (Brief §5.1): validieren, beschaffen, rechnen lassen, uebersetzen,
 * ablegen. Er rechnet nicht und formatiert nicht.
 *
 * Die Reihenfolge ist bindend: Vollstaendigkeitspruefung vor Metadaten, Metadaten vor
 * Berechnung (der Zeitstempel geht in den Eingang, E-29), Ablage zuletzt. Im Fehlerfall
 * entsteht kein Artefakt (I-24).
 */
import { berechne, serialisiereEingang } from '@offert/core';
import { baueOfferte } from '@offert/offer';
import { beschaffe, zuEingangsArgumenten } from '../../../server/eingang.js';
import { erfassungsSchema } from '../../../server/erfassung-schema.js';
import { zuFeldmeldungen } from '../../../server/feldmeldungen.js';
import { uebersetzeStufenFehler } from '../../../server/fehlertexte.js';
import { erzeugeLaufmetadaten } from '../../../server/laufmetadaten.js';
import { holeLaufzeit } from '../../../server/laufzeit.js';
import { legeOfferteAb } from '../../../server/offerten-ablage.js';

export async function POST(anfrage: Request): Promise<Response> {
  const laufzeit = holeLaufzeit(); // PE-24: eine Verdrahtung
  if (!laufzeit.ok) {
    return Response.json({ fehler: { text: laufzeit.meldungen.join(' ') } }, { status: 500 });
  }
  const { konfiguration, fingerabdruck, provider, offertenVerzeichnis } = laufzeit.wert;

  const roh: unknown = await anfrage.json();
  const geprueft = erfassungsSchema(konfiguration).safeParse(roh);
  if (!geprueft.success) {
    return Response.json(
      { meldungen: zuFeldmeldungen(geprueft.error, konfiguration) }, { status: 422 });
  }

  const beschafft = await beschaffe(geprueft.data, provider); // PE-22
  if (!beschafft.ok) {
    return Response.json({ fehler: { text: beschafft.meldung } }, { status: 502 });
  }
  if (!beschafft.wert.buendel.vollstaendig) { // PE-23, I-24
    return Response.json({
      teilergebnis: true,
      fehlgeschlagenerTyp: beschafft.wert.buendel.fehlgeschlagenerTyp,
      fehler: {
        text: 'Für mindestens einen Wohnungstyp liegt keine Bewertung vor. '
          + 'Es wird keine Offerte erzeugt.',
      },
    }, { status: 422 });
  }

  const meta = erzeugeLaufmetadaten(fingerabdruck); // PE-04
  const eingang = zuEingangsArgumenten(
    geprueft.data, beschafft.wert, konfiguration, meta.erstelltAm);
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
    kunde: geprueft.data.kunde,
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
