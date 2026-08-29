/**
 * Reine Logik der Herkunftsanzeige: Welcher Konfigurationspfad wird projektbezogen
 * uebersteuert, und wie setzt man ihn auf den Firmenwert zurueck?
 *
 * Ohne DOM und ohne React, damit die Aussage «dieser Wert weicht ab» ohne gerenderte
 * Oberflaeche pruefbar bleibt — dasselbe Muster wie `spaltenwerte-kaskade.ts`.
 *
 * `setzeZurueck` raeumt leer gewordene Elternobjekte ab. Ohne dieses Abraeumen bliebe
 * ein `{ honorar: { skalierung: {} } }` im Delta stehen; `mergeKonfiguration` liefe
 * zwar sauber durch, aber das Ueberschreibungsprotokoll traege eine Wurzel ohne
 * Wirkung, und die Anzeige meldete faelschlich «uebersteuert».
 */
type Delta = Readonly<Record<string, unknown>>;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

export function istUebersteuert(delta: Delta | undefined, pfad: string): boolean {
  if (delta === undefined) return false;
  let knoten: unknown = delta;
  for (const teil of pfad.split('.')) {
    if (!istObjekt(knoten) || !Object.hasOwn(knoten, teil)) return false;
    knoten = knoten[teil];
  }
  // Ein leeres Objekt am Ende ist keine wirksame Uebersteuerung.
  return !(istObjekt(knoten) && Object.keys(knoten).length === 0);
}

export function setzePfad(
  delta: Delta | undefined, pfad: string, wert: unknown,
): Record<string, unknown> {
  const teile = pfad.split('.');
  const kopie: Record<string, unknown> = { ...(delta ?? {}) };
  let knoten = kopie;
  for (const teil of teile.slice(0, -1)) {
    const vorhanden = knoten[teil];
    knoten[teil] = istObjekt(vorhanden) ? { ...vorhanden } : {};
    knoten = knoten[teil] as Record<string, unknown>;
  }
  knoten[teile[teile.length - 1] as string] = wert;
  return kopie;
}

export function setzeZurueck(
  delta: Delta | undefined, pfad: string,
): Record<string, unknown> {
  if (delta === undefined) return {};
  const teile = pfad.split('.');

  function ohne(knoten: Record<string, unknown>, tiefe: number): Record<string, unknown> {
    const schluessel = teile[tiefe] as string;
    if (!Object.hasOwn(knoten, schluessel)) return knoten;
    const kopie = { ...knoten };
    if (tiefe === teile.length - 1) {
      delete kopie[schluessel];
      return kopie;
    }
    const kind = kopie[schluessel];
    if (!istObjekt(kind)) return kopie;
    const bereinigt = ohne(kind, tiefe + 1);
    if (Object.keys(bereinigt).length === 0) delete kopie[schluessel];
    else kopie[schluessel] = bereinigt;
    return kopie;
  }

  return ohne({ ...delta }, 0);
}
