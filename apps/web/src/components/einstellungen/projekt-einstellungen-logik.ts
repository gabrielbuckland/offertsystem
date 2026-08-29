/**
 * Reine Logik der Projekteinstellungen (Ebene 2 des Zwei-Ebenen-Modells): die beiden
 * Richtungen zwischen Firmenwerten, Delta und dem, was im Formular steht.
 *
 * ANZEIGERICHTUNG (`effektiveKonfiguration`): Firmenwerte mit eingelegtem Delta. Das ist
 * die Grundlage der Darstellung — der Vermarkter soll sehen, WOMIT gerechnet wird, nicht
 * ein leeres Formular mit den drei Feldern, die zufaellig schon einmal uebersteuert
 * wurden.
 *
 * SPEICHERRICHTUNG (`bildeDelta`): der Entwurf zurueck gegen die Firmenwerte gerechnet,
 * sodass nur die Abweichungen abgelegt werden. Beide Richtungen sind zueinander invers
 * (`bildeDelta(effektiveKonfiguration(f, d), f) === d`), und genau das haelt der Test
 * als Rundlauf fest.
 *
 * Ohne React und ohne DOM, damit die tragende Aussage «gespeichert wird nur die
 * Abweichung» ohne gerenderte Oberflaeche pruefbar bleibt — dasselbe Muster wie
 * `herkunft.ts` und `json-reiter-logik.ts`.
 */
import { GESPERRTE_PFADE } from '@offert/core';

type Baum = Readonly<Record<string, unknown>>;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

/**
 * Strukturvergleich ueber die JSON-Form. Zulaessig, weil beide Seiten aus geparstem
 * JSON stammen (Konfigurationsdatei bzw. Projektdatensatz) — dieselbe Begruendung wie
 * bei `entwurfGeaendert` in `verwende-einstellungen.ts`.
 */
function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Effektive Konfiguration = Firmenwerte mit eingelegtem Delta (Anzeigegrundlage). */
export function effektiveKonfiguration(
  firmenwerte: Baum,
  delta: Baum | undefined,
): Record<string, unknown> {
  if (delta === undefined) return { ...firmenwerte };

  const ergebnis: Record<string, unknown> = { ...firmenwerte };
  for (const [schluessel, wert] of Object.entries(delta)) {
    const basis = firmenwerte[schluessel];
    // Arrays und Skalare als Ganzes, nur Objekte rekursiv — dieselbe Regel wie
    // `verschmelzeTeilbaum` im Kern-Merge (`packages/core/src/config/merge.ts`).
    ergebnis[schluessel] = istObjekt(basis) && istObjekt(wert)
      ? effektiveKonfiguration(basis, wert)
      : wert;
  }
  return ergebnis;
}

/**
 * Bildet aus einem bearbeiteten Entwurf das Delta gegen die Firmenwerte: nur Pfade,
 * die tatsaechlich abweichen. Arrays werden als Ganzes verglichen und als Ganzes
 * uebernommen (dieselbe Regel wie im Kern-Merge — elementweises Verschmelzen koennte
 * einen geloeschten Eintrag wieder einfuehren). `meta` und `api` gehoeren nie ins
 * Delta: Sie sind projektbezogen gesperrt.
 *
 * Die gesperrten Wurzeln stehen NICHT als Literale hier, sondern kommen aus
 * `GESPERRTE_PFADE` (`@offert/core`). Das ist zum einen die einzige Wahrheit darueber,
 * was `mergeKonfiguration` ohnehin zurueckweisen wuerde — ein zweiter Literalsatz liefe
 * bei jeder Aenderung aus dem Tritt. Zum anderen scannt der Architekturtest (Task 17)
 * genau diesen Ordner auf fest verdrahtete Konfigurationsbezeichner.
 *
 * NICHT ausdrueckbar ist das ENTFERNEN eines Firmenschluessels: Ein Merge, der Werte nur
 * ueberlagert, hat keine Form fuer «dieser Schluessel soll hier fehlen». Ein im Entwurf
 * fehlender Schluessel gilt deshalb als unveraendert, nicht als geloescht — dieselbe
 * Grenze wie im Kern-Merge, und die ehrlichere Auslegung: Ein per JSON-Reiter
 * versehentlich weggeloeschter Block soll nicht stillschweigend die Berechnungsbasis
 * beschneiden.
 */
export function bildeDelta(
  entwurf: Baum,
  firmenwerte: Baum,
): Record<string, unknown> {
  // Die Sperre greift NUR auf der Wurzel — wie im Kern-Merge, der `GESPERRTE_PFADE`
  // ebenfalls nur gegen die obersten Schluessel prueft. Ein tiefer liegendes Feld, das
  // zufaellig `meta` heisst (etwa in einer Faktor-Herkunftsangabe), ist ein gewoehnlicher
  // Konfigurationswert und bleibt uebersteuerbar.
  return baueDelta(entwurf, firmenwerte, true);
}

/**
 * Befunde, die KEINE Bereichskarte zeigen kann — der Auffangblock der Projektebene.
 *
 * Die Karten decken zwei Anzeigeregeln ab: der Rahmen zeigt den unanhaengigen Befund
 * (`pfad === ''`) und einen Befund genau auf einer Bereichswurzel (`rahmenBefunde`), die
 * Feld-Editoren zeigen alles darunter (`befundeFuerPfad`). Was ausserhalb JEDER
 * Bereichswurzel liegt, faellt durch beide Regeln: ein gesperrter Pfad (`api`, `meta`),
 * ein Rumpf-Befund (`(rumpf)`) oder ein unbekannter Schluessel auf der Wurzel. Ohne
 * Auffangblock quittierte die Oberflaeche ein gescheitertes Speichern kommentarlos — der
 * Benutzer klickte «Speichern», nichts geschah sichtbar, und er hielt den Vorgang fuer
 * erfolgreich.
 *
 * Die Bereichswurzeln kommen als Parameter herein und stehen NICHT als Literale hier:
 * Dieser Ordner wird vom Architekturtest auf fest verdrahtete Konfigurationsbezeichner
 * gescannt, und die Zuordnung lebt ohnehin in `bereiche.ts`.
 */
export function unverankerteBefunde<T extends { readonly pfad: string }>(
  befunde: readonly T[], wurzeln: readonly string[],
): readonly T[] {
  return befunde.filter((befund) => befund.pfad !== '' && !wurzeln.some(
    (wurzel) => befund.pfad === wurzel
      || befund.pfad.startsWith(`${wurzel}.`)
      || befund.pfad.startsWith(`${wurzel}[`),
  ));
}

function baueDelta(entwurf: Baum, firmenwerte: Baum, wurzel: boolean): Record<string, unknown> {
  const delta: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(entwurf)) {
    if (wurzel && GESPERRTE_PFADE.includes(schluessel)) continue;
    const basis = firmenwerte[schluessel];

    if (istObjekt(basis) && istObjekt(wert)) {
      const teilDelta = baueDelta(wert, basis, false);
      // Ein leerer Teilbaum kommt NICHT ins Delta: Er traege eine Wurzel ohne Wirkung,
      // und die Herkunftsanzeige (`istUebersteuert`) meldete faelschlich «uebersteuert».
      if (Object.keys(teilDelta).length > 0) delta[schluessel] = teilDelta;
      continue;
    }

    if (!gleich(basis, wert)) delta[schluessel] = wert;
  }
  return delta;
}
