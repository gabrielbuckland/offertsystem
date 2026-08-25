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
      flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1,
      spaltenwerte: { 'S-1': 0.05, 'S-2': 10_000 },
    }],
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
});
