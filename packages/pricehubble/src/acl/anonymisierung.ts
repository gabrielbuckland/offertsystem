/**
 * Keine Formel. Anonymisierung — angewendet VOR dem Schreiben, damit unanonymisiertes
 * Material zu keinem Zeitpunkt auf Platte liegt (E-31). Kein Fixture enthaelt
 * Zugangsdaten, Token oder personenbezogene Daten.
 */
export const TEST_UUID = '00000000-0000-4000-8000-000000000001';

const BEISPIELADRESSE = {
  street: 'Musterstrasse',
  houseNumber: '1',
  postCode: '6000',
  city: 'Luzern',
} as const;

const BEISPIELKOORDINATEN = { latitude: 47.05, longitude: 8.3 } as const;

const ZU_ENTFERNEN = new Set([
  'createdBy',
  'modifiedBy',
  'ownedBy',
  'title',
  'description',
  'priceStrategyDescription',
  'isPriceStrategyDescriptionEdited',
]);

export function anonymisiere(wert: unknown): unknown {
  if (Array.isArray(wert)) {
    return wert.map(anonymisiere);
  }
  if (wert === null || typeof wert !== 'object') {
    return wert;
  }
  const ergebnis: Record<string, unknown> = {};
  for (const [schluessel, inhalt] of Object.entries(wert as Record<string, unknown>)) {
    if (ZU_ENTFERNEN.has(schluessel)) {
      continue;
    }
    if (schluessel === 'id' || schluessel === 'dossierId') {
      ergebnis[schluessel] = TEST_UUID;
    } else if (schluessel === 'address') {
      ergebnis[schluessel] = { ...BEISPIELADRESSE };
    } else if (schluessel === 'coordinates') {
      ergebnis[schluessel] = { ...BEISPIELKOORDINATEN };
    } else {
      ergebnis[schluessel] = anonymisiere(inhalt);
    }
  }
  return ergebnis;
}
