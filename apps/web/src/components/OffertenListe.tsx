/**
 * Uebersicht der erzeugten Offerten (A-12, US-13).
 *
 * Ein schemawidriges Artefakt wird GEKENNZEICHNET, nicht teilweise dargestellt: Eine
 * halb gezeigte Offerte sieht aus wie ein Ergebnis, ohne eines zu sein (I-24).
 */
import { formatiereAggregat, formatiereDatum } from '@offert/offer';
import type { ListenEintrag } from '../server/offerten-ablage.js';

export function OffertenListe({ eintraege }: { eintraege: readonly ListenEintrag[] }) {
  if (eintraege.length === 0) {
    return <p>Es wurden noch keine Offerten erzeugt.</p>;
  }
  return (
    <table className="offertenliste">
      <thead><tr><th>Erstellt am</th><th>Referenz</th><th>Kunde</th><th>Liegenschaft</th>
                 <th>Verkaufssumme</th><th>Honorarrange</th><th /></tr></thead>
      <tbody>
        {eintraege.map((e) => (
          <tr key={e.datei} data-fehlerhaft={e.fehlerhaft}>
            {e.fehlerhaft || e.verkaufssumme === undefined
              || e.honorarMin === undefined || e.honorarMax === undefined ? (
              <>
                <td>{e.erstelltAm}</td>
                <td colSpan={6}>
                  Das Artefakt «{e.datei}» entspricht nicht dem Offert-Schema und wird
                  nicht dargestellt.
                </td>
              </>
            ) : (
              <>
                <td>{formatiereDatum(e.erstelltAm)}</td>
                <td>{e.referenznummer}</td>
                <td>{e.kunde}</td>
                <td>{e.liegenschaft}</td>
                <td>{formatiereAggregat(e.verkaufssumme)}</td>
                <td>{formatiereAggregat(e.honorarMin)} – {formatiereAggregat(e.honorarMax)}</td>
                <td><a href={`/offerte/${e.offertId}`}>öffnen</a></td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
