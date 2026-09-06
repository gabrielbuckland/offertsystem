// PE-21: Duenner Adapter, Rechenweg liegt in server/projekt-lauf.ts (geteilt mit Offert-Route).
import { uebersetzeStufenFehler } from '../../../../../server/fehlertexte.js';
import { holeLaufzeit, holeProjektLaufzeit } from '../../../../../server/laufzeit.js';
import { ladeProjekt } from '../../../../../server/projekt-ablage.js';
import { fuehreProjektlauf } from '../../../../../server/projekt-lauf.js';

interface Kontext { readonly params: Promise<{ readonly id: string }> }

export async function POST(_anfrage: Request, kontext: Kontext): Promise<Response> {
  // Henne-Ei: Projektverzeichnis aus firmenweiter Laufzeit, Delta erst aus geladenem Projekt.
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

  const lauf = await fuehreProjektlauf(id, laufzeit.wert);
  switch (lauf.art) {
    case 'unvollstaendig':
      return Response.json({ unvollstaendig: true }, { status: 200 });
    case 'bewertungLuecke':
      return Response.json({
        fehler: {
          text: 'Für mindestens einen Wohnungstyp liegt keine Bewertung vor. '
            + 'Es werden keine Preise ausgewiesen.',
        },
      }, { status: 422 });
    case 'honorarAbbruch':
      // E-04: Status 200, da nur die Honorarrange fehlt, Wohnungspreise/Aufwandindikator bleiben gueltig.
      return Response.json({
        honorarAbbruch: {
          ...lauf.teilergebnis,
          meldung: uebersetzeStufenFehler(lauf.fehler).text,
        },
      }, { status: 200 });
    case 'fehler':
      // Unveraendert durchgereicht: traegt auch `adressat` und ggf. `feldpfad`.
      return Response.json({ fehler: lauf.fehler }, { status: lauf.status });
    case 'offerte': {
      const o = lauf.offerte;
      return Response.json({
        einheiten: o.derivation.units.map((u) => ({
          id: lauf.einheitenIds.get(u.unitNumber) ?? u.unitNumber,
          wohnungsnummer: u.unitNumber,
          basispreis: u.basePrice.value,
          preis: u.unitPrice.value,
        })),
        verkaufssumme: o.aggregates.totalSalesValue.value,
        honorarMin: o.aggregates.feeRange.value.min,
        honorarMax: o.aggregates.feeRange.value.max,
        herleitung: { derivation: o.derivation, aggregates: o.aggregates },
        // Projektbezogener Konfigurationsstand (Ebene 2), nicht Firmenstand.
        metadaten: { konfigPruefsumme: o.metadata.konfigPruefsumme },
      }, { status: 200 });
    }
  }
}
