import { describe, expect, it } from 'vitest';
import { projektSchema } from '../../src/server/projekt-schema.js';

function beispiel() {
  return {
    schemaVersion: 1,
    id: '3f1c0d54-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    adresse: { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' },
    referenzobjekte: [{
      id: 'R-1', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
        zustandsbewertungen: {}, qualitaetsbewertungen: {},
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
      },
    }],
    anpassungsSpalten: [
      { id: 'S-1', bezeichnung: 'Zuschlag Etage', erfassungsform: 'absolut', vorgabewert: 0 },
    ],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1,
      spaltenwerte: { 'S-1': 10_000 }, manuelleAnpassungen: [],
    }],
    aufwandfaktoren: {},
    meta: { erstelltAm: '2026-08-24T10:00:00.000Z', geaendertAm: '2026-08-24T10:00:00.000Z' },
  };
}

describe('projektSchema', () => {
  it('nimmt ein vollstaendiges Projekt an', () => {
    expect(projektSchema.safeParse(beispiel()).success).toBe(true);
  });

  it('weist eine Einheit mit unbekanntem Referenzobjekt zurueck', () => {
    const p = beispiel();
    p.einheiten[0]!.referenzobjektId = 'R-9';
    const ergebnis = projektSchema.safeParse(p);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(JSON.stringify(ergebnis.error.issues)).toContain('REFERENZOBJEKT_UNBEKANNT');
  });

  it('weist doppelte Wohnungsnummern zurueck', () => {
    const p = beispiel();
    p.einheiten.push({ ...p.einheiten[0]!, id: 'E-2' });
    const ergebnis = projektSchema.safeParse(p);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(JSON.stringify(ergebnis.error.issues)).toContain('NUMMER_DOPPELT');
  });

  it('laesst ein leeres Projekt ohne Einheiten zu', () => {
    const p = beispiel();
    p.einheiten = [];
    expect(projektSchema.safeParse(p).success).toBe(true);
  });
});
