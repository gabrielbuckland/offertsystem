import { describe, expect, it } from 'vitest';
import { projiziere } from '../../src/server/projektion.js';
import type { Projekt } from '../../src/server/projekt-schema.js';
import { BEWERTUNGEN_STANDARD } from '../bau/bewertungen.js';

function projekt(): Projekt {
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
      { id: 'S-1', bezeichnung: 'Zuschlag Etage', erfassungsform: 'relativ', vorgabewert: 0 },
      { id: 'S-2', bezeichnung: 'Aussicht', erfassungsform: 'absolut', vorgabewert: 0 },
    ],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19,
      spaltenwerte: { 'S-1': 0.05, 'S-2': 10_000 }, merkmalswerte: {},
    }],
    merkmale: [],
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
    meta: { erstelltAm: '2026-08-24T10:00:00.000Z', geaendertAm: '2026-08-24T10:00:00.000Z' },
  };
}

describe('projiziere', () => {
  it('bildet Referenzobjekte auf Wohnungstypen ab', () => {
    const e = projiziere(projekt(), { 'E-1': 1_000_000 });
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.wert.wohnungstypen).toHaveLength(1);
    expect(e.wert.wohnungstypen[0]!.id).toBe('R-1');
    expect(e.wert.wohnungstypen[0]!.zimmerzahl).toBe(3.5);
  });

  it('verflacht Spaltenwerte in ein Anpassungsarray', () => {
    const e = projiziere(projekt(), { 'E-1': 1_000_000 });
    if (!e.ok) return;
    const a = e.wert.einheiten[0]!.anpassungen;
    expect(a).toHaveLength(2);
    expect(a.map((x) => x.begruendung)).toEqual(['Zuschlag Etage', 'Aussicht']);
  });

  it('rechnet einen Frankenbetrag ueber den Basispreis in einen Faktor um', () => {
    const e = projiziere(projekt(), { 'E-1': 1_000_000 });
    if (!e.ok) return;
    const absolut = e.wert.einheiten[0]!.anpassungen[1]!;
    expect(absolut.faktor).toBeCloseTo(0.01, 10);
    expect(absolut.erfassungsform).toBe('absolut');
    expect(absolut.erfassterBetrag).toBe(10_000);
  });

  it('laesst Spalten ohne gesetzten Wert weg, statt eine Null-Position zu erzeugen', () => {
    const p = projekt();
    p.einheiten[0]!.spaltenwerte = { 'S-1': 0.05 };
    const e = projiziere(p, { 'E-1': 1_000_000 });
    if (!e.ok) return;
    expect(e.wert.einheiten[0]!.anpassungen).toHaveLength(1);
  });

  it('meldet einen fehlenden Basispreis, statt still mit null zu rechnen', () => {
    const e = projiziere(projekt(), {});
    expect(e.ok).toBe(false);
    if (e.ok) return;
    expect(e.meldung).toContain('A-01');
  });

  it('laesst mit ohneAnpassungen auch ohne Basispreise erfolgreich, mit leeren Anpassungen', () => {
    const e = projiziere(projekt(), {}, { ohneAnpassungen: true });
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.wert.einheiten[0]!.anpassungen).toEqual([]);
  });

  it('delegiert die Regel-/Uebersteuerungsauswertung an ermittleWirksamenWert (Smoke-Test)', () => {
    // Die Feinlogik (Regel vs. Uebersteuerung, fehlender Merkmalswert, 0-Werte als
    // gueltiges Ergebnis) ist bereits vollstaendig in wirksamer-wert.test.ts abgedeckt,
    // da projiziere() nur an ermittleWirksamenWert delegiert. Hier genuegt der Nachweis,
    // dass die Uebersteuerung samt Regelspur unveraendert durchgereicht wird und dass ein
    // wirksamer Wert von 0 — egal ob aus Regel oder Zelle — projektionsseitig zu keiner
    // Position fuehrt.
    const uebersteuert = projiziere(projektMitRegel({ stockwerk: 1 }, { 'S-1': 500000 }), { 'E-1': 100_000_00 });
    expect(uebersteuert.ok).toBe(true);
    if (!uebersteuert.ok) return;
    const anpassung = uebersteuert.wert.einheiten[0]!.anpassungen[0]!;
    expect(anpassung.uebersteuert).toBe(true);
    expect(anpassung.regel).toEqual({
      merkmal: 'stockwerk', merkmalswert: 1, bereich: 1, regelwert: 1000000,
    });

    const nullAusRegel = projiziere(
      projektMitBereichen({ stockwerk: 3 }, {}, [{ unter: 5, wert: 0 }, { wert: 999 }]),
      { 'E-1': 100_000_00 },
    );
    const nullAusZelle = projiziere(projektMitRegel({ stockwerk: 2 }, { 'S-1': 0 }), { 'E-1': 100_000_00 });
    expect(nullAusRegel.ok && nullAusRegel.wert.einheiten[0]!.anpassungen).toHaveLength(0);
    expect(nullAusZelle.ok && nullAusZelle.wert.einheiten[0]!.anpassungen).toHaveLength(0);
  });

  it('wertet einen Merkmalswert von 0 korrekt aus, statt ihn als fehlend zu behandeln', () => {
    // Gegenprobe zum vorigen Test: hier ist der MERKMALSWERT 0, der Treffer aber
    // ungleich 0. Eine Regression, die 0 mit "fehlend" verwechselt, wuerde hier
    // faelschlich keine Position erzeugen.
    const p = projektMitBereichen({ stockwerk: 0 }, {}, [{ unter: 1, wert: 500000 }, { wert: 999 }]);
    const ergebnis = projiziere(p, { 'E-1': 100_000_00 });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const anpassungen = ergebnis.wert.einheiten[0]!.anpassungen;
    expect(anpassungen).toHaveLength(1);
    expect(anpassungen[0]!.regel).toEqual({
      merkmal: 'stockwerk', merkmalswert: 0, bereich: 0, regelwert: 500000,
    });
  });

  it('erzeugt keine Position, wenn der Merkmalswert fehlt', () => {
    const ergebnis = projiziere(projektMitRegel({}, {}), { 'E-1': 100_000_00 });
    expect(ergebnis.ok && ergebnis.wert.einheiten[0]!.anpassungen).toHaveLength(0);
  });

  it('reicht Regelspur und Uebersteuerung auch bei einer regelgetriebenen relativ-Spalte durch', () => {
    const p = projektMitRegel({ stockwerk: 2 }, { 'S-1': 0.03 });
    const relativ = {
      ...p,
      anpassungsSpalten: [{ ...p.anpassungsSpalten[0]!, erfassungsform: 'relativ' as const }],
    };
    const ergebnis = projiziere(relativ, { 'E-1': 100_000_00 });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const anpassung = ergebnis.wert.einheiten[0]!.anpassungen[0]!;
    expect(anpassung.erfassungsform).toBe('relativ');
    expect(anpassung.faktor).toBe(0.03);
    expect(anpassung.uebersteuert).toBe(true);
    expect(anpassung.regel).toEqual({
      merkmal: 'stockwerk', merkmalswert: 2, bereich: 2, regelwert: 2000000,
    });
  });

  it('behaelt die Spaltenreihenfolge bei, auch wenn eine Spalte regelgetrieben ist (NFA-06)', () => {
    const p = projektMitRegel({ stockwerk: 2 }, { 'S-2': 0.03 });
    const gemischt = {
      ...p,
      anpassungsSpalten: [
        p.anpassungsSpalten[0]!,
        { id: 'S-2', bezeichnung: 'Aussicht', erfassungsform: 'relativ' as const, vorgabewert: 0 },
      ],
    };
    const ergebnis = projiziere(gemischt, { 'E-1': 100_000_00 });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.einheiten[0]!.anpassungen.map((a) => a.vorlageId))
      .toEqual(['S-1', 'S-2']);
  });
});

function projektMitRegel(
  merkmalswerte: Record<string, number>,
  spaltenwerte: Record<string, number>,
) {
  const p = projekt();
  return {
    ...p,
    merkmale: [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' as const }],
    anpassungsSpalten: [{
      id: 'S-1', bezeichnung: 'Zuschlag Stockwerk', erfassungsform: 'absolut' as const,
      regel: {
        merkmal: 'stockwerk',
        bereiche: [{ unter: 1, wert: 0 }, { unter: 2, wert: 1000000 }, { wert: 2000000 }],
      },
    }],
    einheiten: [{ ...p.einheiten[0]!, spaltenwerte, merkmalswerte }],
  };
}

/** Wie `projektMitRegel`, aber mit frei waehlbarer Staffel — fuer Faelle, in denen die
 * konkreten Bereichswerte den Unterschied zwischen "0 als Ergebnis" und "fehlend" tragen
 * muessen (siehe Tests zum Merkmalswert 0). */
function projektMitBereichen(
  merkmalswerte: Record<string, number>,
  spaltenwerte: Record<string, number>,
  bereiche: { unter?: number; wert: number }[],
) {
  const p = projektMitRegel(merkmalswerte, spaltenwerte);
  return {
    ...p,
    anpassungsSpalten: [{ ...p.anpassungsSpalten[0]!, regel: { merkmal: 'stockwerk', bereiche } }],
  };
}
