import { describe, expect, it } from 'vitest';
import { projiziere } from '../../src/server/projektion.js';
import type { Projekt } from '../../src/server/projekt-schema.js';

function projekt(): Projekt {
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

  it('leitet eine Position aus der Regel ab, ohne dass ein Spaltenwert erfasst ist', () => {
    const p = projektMitRegel({ stockwerk: 2 }, {});
    const ergebnis = projiziere(p, { 'E-1': 100_000_00 });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const anpassungen = ergebnis.wert.einheiten[0]!.anpassungen;
    expect(anpassungen).toHaveLength(1);
    expect(anpassungen[0]!.regel).toEqual({
      merkmal: 'stockwerk', merkmalswert: 2, bereich: 2, regelwert: 2000000,
    });
  });

  it('erzeugt keine Position, wenn der wirksame Wert 0 ist — gleich ob aus Regel oder Zelle', () => {
    const ausRegel = projiziere(projektMitRegel({ stockwerk: 0 }, {}), { 'E-1': 100_000_00 });
    expect(ausRegel.ok && ausRegel.wert.einheiten[0]!.anpassungen).toHaveLength(0);

    const ausZelle = projiziere(projektMitRegel({ stockwerk: 2 }, { 'S-1': 0 }), { 'E-1': 100_000_00 });
    expect(ausZelle.ok && ausZelle.wert.einheiten[0]!.anpassungen).toHaveLength(0);
  });

  it('erzeugt keine Position, wenn der Merkmalswert fehlt', () => {
    const ergebnis = projiziere(projektMitRegel({}, {}), { 'E-1': 100_000_00 });
    expect(ergebnis.ok && ergebnis.wert.einheiten[0]!.anpassungen).toHaveLength(0);
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
