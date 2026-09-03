import { describe, expect, it } from 'vitest';
import { projektSchema } from '../../src/server/projekt-schema.js';
import { BEWERTUNGEN_STANDARD } from '../bau/bewertungen.js';

function beispiel() {
  return {
    schemaVersion: 1,
    id: '3f1c0d54-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    adresse: { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' },
    referenzobjekte: [{
      id: 'R-1', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'minergie_p' as const,
        ...BEWERTUNGEN_STANDARD,
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump_air' as const,
      },
    }],
    anpassungsSpalten: [
      { id: 'S-1', bezeichnung: 'Zuschlag Etage', erfassungsform: 'absolut', vorgabewert: 0 },
    ],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19,
      spaltenwerte: { 'S-1': 10_000 },
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

  it('weist doppelte Einheiten-Ids zurueck', () => {
    const p = beispiel();
    p.einheiten.push({ ...p.einheiten[0]!, wohnungsnummer: 'A-02' });
    const ergebnis = projektSchema.safeParse(p);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(JSON.stringify(ergebnis.error.issues)).toContain('EINHEIT_ID_DOPPELT');
  });

  // Das Feld wurde aufgegeben (Einheiten tragen ihre Unterschiede in `spaltenwerte`).
  // `.strict()` haelt das fest: Ein aelteres Artefakt wird abgewiesen statt stillschweigend
  // uebernommen — sonst truege die Ablage ein Feld, das keine Berechnung mehr liest.
  it('weist eine Einheit mit dem aufgegebenen Feld stockwerk zurueck', () => {
    const p = beispiel();
    const ergebnis = projektSchema.safeParse({
      ...p,
      einheiten: [{ ...p.einheiten[0]!, stockwerk: 1 }],
    });
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(ergebnis.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
  });

  // Gegenprobe: Die Referenzobjekt-Parametrisierung fuehrt `stockwerk` weiter — es ist
  // der Dossier-Parameter der Bewertung (PriceHubble `floorNumber`), kein Merkmal der
  // einzelnen Einheit.
  it('fuehrt stockwerk in der Referenzobjekt-Parametrisierung weiter', () => {
    expect(projektSchema.safeParse(beispiel()).success).toBe(true);
    const p = beispiel();
    const { stockwerk: _weg, ...ohne } = p.referenzobjekte[0]!.parametrisierung;
    const ergebnis = projektSchema.safeParse({
      ...p,
      referenzobjekte: [{ ...p.referenzobjekte[0]!, parametrisierung: ohne }],
    });
    expect(ergebnis.success).toBe(false);
  });

  it('laesst ein leeres Projekt ohne Einheiten zu', () => {
    const p = beispiel();
    p.einheiten = [];
    expect(projektSchema.safeParse(p).success).toBe(true);
  });

  it('nimmt ein Projekt ohne Merkmale und ohne Regeln an — Bestandsartefakte bleiben gueltig', () => {
    const p = beispiel();
    expect(projektSchema.safeParse(p).success).toBe(true);
    expect(projektSchema.parse(p).merkmale).toEqual([]);
    expect(projektSchema.parse(p).einheiten[0]!.merkmalswerte).toEqual({});
  });

  it('nimmt eine Spalte mit gueltiger Bereichsregel an', () => {
    const p = beispiel();
    const ergebnis = projektSchema.safeParse({
      ...p,
      merkmale: [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' }],
      anpassungsSpalten: [{
        id: 'S-1', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut',
        regel: {
          merkmal: 'stockwerk',
          bereiche: [{ unter: 1, wert: 0 }, { wert: 1000000 }],
        },
      }],
      einheiten: [{ ...p.einheiten[0]!, merkmalswerte: { stockwerk: 2 } }],
    });
    expect(ergebnis.success).toBe(true);
  });

  it('weist eine Spalte mit Regel und Vorgabewert zugleich zurueck', () => {
    const p = beispiel();
    const ergebnis = projektSchema.safeParse({
      ...p,
      merkmale: [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' }],
      anpassungsSpalten: [{
        id: 'S-1', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut',
        vorgabewert: 500,
        regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }, { wert: 1000000 }] },
      }],
    });
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(JSON.stringify(ergebnis.error.issues)).toContain('REGEL_UND_VORGABEWERT');
  });

  it('weist eine Staffel ohne Restfall zurueck', () => {
    const p = beispiel();
    const ergebnis = projektSchema.safeParse({
      ...p,
      merkmale: [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' }],
      anpassungsSpalten: [{
        id: 'S-1', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut',
        regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }] },
      }],
    });
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(JSON.stringify(ergebnis.error.issues)).toContain('BEREICHE_UNGUELTIG');
  });

  it('weist eine Regel auf ein nicht deklariertes Merkmal zurueck', () => {
    const p = beispiel();
    const ergebnis = projektSchema.safeParse({
      ...p,
      anpassungsSpalten: [{
        id: 'S-1', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut',
        regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }, { wert: 1000000 }] },
      }],
    });
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(JSON.stringify(ergebnis.error.issues)).toContain('MERKMAL_UNBEKANNT');
  });

  it('nimmt ein Einstellungs-Delta an', () => {
    const ergebnis = projektSchema.safeParse({
      ...beispiel(),
      einstellungen: { flaeche: { alpha: 0.6 } },
    });
    expect(ergebnis.success).toBe(true);
    if (!ergebnis.success) return;
    expect(ergebnis.data.einstellungen).toEqual({ flaeche: { alpha: 0.6 } });
  });

  it('bleibt ohne Einstellungs-Delta gueltig — Bestandsartefakte (I-24)', () => {
    const ergebnis = projektSchema.safeParse(beispiel());
    expect(ergebnis.success).toBe(true);
    if (!ergebnis.success) return;
    expect(ergebnis.data.einstellungen).toBeUndefined();
  });

  it('weist ein Delta zurueck, das kein Objekt an der Wurzel ist', () => {
    const ergebnis = projektSchema.safeParse({
      ...beispiel(), einstellungen: [1, 2, 3],
    });
    expect(ergebnis.success).toBe(false);
  });
});
