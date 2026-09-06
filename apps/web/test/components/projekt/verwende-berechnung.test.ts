import { describe, expect, it } from 'vitest';
import {
  verarbeiteBerechnungsAntwort, type BerechnungsAntwort,
} from '../../../src/components/projekt/verwende-berechnung.js';
import type { ApiErgebnis } from '../../../src/components/rufe-api.js';

/**
 * Reine Verarbeitung getrennt vom Hook getestet (kein jsdom in diesem Repo) —
 * Testdaten sind Literale, ohne fetch.
 */
function ergebnis(
  teil: Partial<ApiErgebnis<BerechnungsAntwort>>,
): ApiErgebnis<BerechnungsAntwort> {
  return { ok: true, status: 200, rumpf: {}, ...teil };
}

/** Projektstand, gegen den die Antwort gelesen wird: Die Route liefert das
 *  E-04-Teilergebnis nach Wohnungsnummer, die Tabelle greift nach Einheitenkennung zu. */
const EINHEITEN = [
  { id: 'e1', wohnungsnummer: 'A1' },
  { id: 'e2', wohnungsnummer: 'A2' },
];

describe('verarbeiteBerechnungsAntwort', () => {
  it('legt bei Erfolg Preise nach id ab und uebernimmt die Herleitung', () => {
    const antwort = ergebnis({
      rumpf: {
        einheiten: [
          { id: 'e1', wohnungsnummer: 'A1', basispreis: 500_000, preis: 520_000 },
          { id: 'e2', wohnungsnummer: 'A2', basispreis: 400_000, preis: 410_000 },
        ],
        verkaufssumme: 930_000,
        honorarMin: 10_000,
        honorarMax: 15_000,
        herleitung: { derivation: { units: [] }, aggregates: { totalSalesValue: 930_000 } },
      },
    });

    const { stand, ok } = verarbeiteBerechnungsAntwort(antwort, EINHEITEN);

    expect(ok).toBe(true);
    expect(stand.preise).toEqual({
      e1: { basispreis: 500_000, preis: 520_000 },
      e2: { basispreis: 400_000, preis: 410_000 },
    });
    expect(stand.verkaufssumme).toBe(930_000);
    expect(stand.honorarMin).toBe(10_000);
    expect(stand.honorarMax).toBe(15_000);
    expect(stand.herleitung).toEqual({
      derivation: { units: [] }, aggregates: { totalSalesValue: 930_000 },
    });
    expect(stand.honorarAbbruch).toBeUndefined();
    expect(stand.fehler).toBeUndefined();
  });

  it('meldet bei unvollstaendigem Projekt keine Aggregate, aber auch keinen Fehler (I-24)', () => {
    const antwort = ergebnis({ rumpf: { unvollstaendig: true } });

    const { stand, ok } = verarbeiteBerechnungsAntwort(antwort, EINHEITEN);

    expect(ok).toBe(true);
    expect(stand.preise).toEqual({});
    expect(stand.verkaufssumme).toBeUndefined();
    expect(stand.honorarMin).toBeUndefined();
    expect(stand.honorarMax).toBeUndefined();
    expect(stand.honorarAbbruch).toBeUndefined();
    expect(stand.fehler).toBeUndefined();
  });

  it('haelt bei einem Honorarabbruch (E-04) das Teilergebnis fest, ohne Aggregate oder Fehler', () => {
    const honorarAbbruch = {
      verkaufssumme: 5_000_000,
      aufwandindikator: 2.5,
      positionen: [{ wohnungsnummer: 'A1', preis: 520_000 }],
      meldung: 'Die Verkaufssumme liegt ausserhalb der konfigurierten Staffel.',
    };
    const antwort = ergebnis({ rumpf: { honorarAbbruch } });

    const { stand, ok } = verarbeiteBerechnungsAntwort(antwort, EINHEITEN);

    expect(ok).toBe(true);
    expect(stand.honorarAbbruch).toEqual(honorarAbbruch);
    expect(stand.verkaufssumme).toBeUndefined();
    expect(stand.honorarMin).toBeUndefined();
    expect(stand.honorarMax).toBeUndefined();
    expect(stand.fehler).toBeUndefined();
  });

  it('behaelt bei einem Honorarabbruch (E-04) die Einheitenpreise sichtbar (Spec §5)', () => {
    // Regression: Die Route liefert die Wohnungspreise sehr wohl mit — sie stehen in
    // `honorarAbbruch.positionen`, nach Wohnungsnummer statt nach Kennung. Wurden sie
    // hier verworfen, zeigte die Einheitentabelle neben einer gueltigen Verkaufssumme
    // und einem gueltigen D fuer JEDE Einheit «—».
    const antwort = ergebnis({
      rumpf: {
        honorarAbbruch: {
          verkaufssumme: 930_000,
          aufwandindikator: 2.5,
          positionen: [
            { wohnungsnummer: 'A1', preis: 520_000 },
            { wohnungsnummer: 'A2', preis: 410_000 },
          ],
          meldung: 'Die Verkaufssumme liegt ausserhalb der konfigurierten Staffel.',
        },
      },
    });

    const { stand } = verarbeiteBerechnungsAntwort(antwort, EINHEITEN);

    expect(stand.preise).toEqual({ e1: { preis: 520_000 }, e2: { preis: 410_000 } });
    // Kein erfundener Basispreis: Das Teilergebnis fuehrt keinen.
    expect(stand.preise['e1']?.basispreis).toBeUndefined();
  });

  it('laesst eine Position ohne passende Einheit weg, statt sie unter der Nummer abzulegen', () => {
    const antwort = ergebnis({
      rumpf: {
        honorarAbbruch: {
          verkaufssumme: 520_000,
          aufwandindikator: 2.5,
          positionen: [{ wohnungsnummer: 'GELOESCHT', preis: 520_000 }],
          meldung: 'Die Verkaufssumme liegt ausserhalb der konfigurierten Staffel.',
        },
      },
    });

    expect(verarbeiteBerechnungsAntwort(antwort, EINHEITEN).stand.preise).toEqual({});
  });

  it('leert die Aggregate und setzt den Fehlertext bei einer fehlgeschlagenen Antwort', () => {
    const antwort = ergebnis({
      ok: false, status: 422, rumpf: { fehler: { text: 'Kaputte Anfrage.' } },
    });

    const { stand, ok } = verarbeiteBerechnungsAntwort(antwort, EINHEITEN);

    expect(ok).toBe(false);
    expect(stand.preise).toEqual({});
    expect(stand.verkaufssumme).toBeUndefined();
    expect(stand.honorarMin).toBeUndefined();
    expect(stand.honorarMax).toBeUndefined();
    expect(stand.honorarAbbruch).toBeUndefined();
    expect(stand.fehler).toBe('Kaputte Anfrage.');
  });

  it('faellt bei einer fehlgeschlagenen Antwort ohne Text (Netzausfall in rufeApi) auf eine Standardmeldung zurueck', () => {
    const antwort = ergebnis({ ok: false, status: 0, rumpf: {} });

    const { stand, ok } = verarbeiteBerechnungsAntwort(antwort, EINHEITEN);

    expect(ok).toBe(false);
    expect(stand.fehler).toBe('Die Berechnung ist fehlgeschlagen.');
  });
});
