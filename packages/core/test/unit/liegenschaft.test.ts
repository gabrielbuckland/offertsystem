import { describe, expect, it } from 'vitest';
import { erzeugeLiegenschaft } from '../../src/domain/liegenschaft.js';
import type { LiegenschaftEntwurf } from '../../src/domain/liegenschaft.js';
import { quadratmeter, quadratmeterAbNull } from '../../src/domain/geld.js';
import { einheitId, liegenschaftId, wohnungsnummer, wohnungstypId } from '../../src/domain/ids.js';

const parametrisierung = {
  flaecheInnen: quadratmeter(92.5),
  flaecheAussen: quadratmeterAbNull(0),
  stockwerk: 1,
  energielabel: 'B',
  zustandsbewertungen: { bathrooms: 'well_maintained' },
  qualitaetsbewertungen: { bathrooms: 'normal' },
  anzahlBadezimmer: 1,
  lift: true,
  baujahr: 2025,
  heizungsart: 'heat_pump',
} as const;

function entwurf(ueberschreibung: Partial<LiegenschaftEntwurf> = {}): LiegenschaftEntwurf {
  return {
    id: liegenschaftId('L-1'),
    adresse: { strasse: 'Bahnhofstrasse', hausnummer: '1', plz: '6003', ort: 'Luzern' },
    baujahr: 2025,
    grundstuecksflaeche: quadratmeter(800),
    wohnungstypen: [
      { id: wohnungstypId('T1'), zimmerzahl: 3.5, parametrisierung },
    ],
    einheiten: [
      {
        id: einheitId('E-1'), wohnungsnummer: wohnungsnummer('A-01'),
        wohnungstypId: wohnungstypId('T1'), flaecheInnen: quadratmeter(92.5),
        flaecheAussen: quadratmeterAbNull(0), stockwerk: 1, parkplaetze: 1, anpassungen: [],
      },
    ],
    ...ueberschreibung,
  };
}

describe('erzeugeLiegenschaft — Aggregatpruefungen (I-01, US-01, US-02)', () => {
  it('nimmt ein gueltiges Aggregat an', () => {
    const e = erzeugeLiegenschaft(entwurf());
    expect(e.ok).toBe(true);
  });

  it('weist doppelte Wohnungsnummern zurueck (I-01)', () => {
    const basis = entwurf();
    const zweite = { ...basis.einheiten[0]!, id: einheitId('E-2') };
    const e = erzeugeLiegenschaft(entwurf({ einheiten: [basis.einheiten[0]!, zweite] }));
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.fehler.map((f) => f.code)).toContain('WOHNUNGSNUMMER_DOPPELT');
  });

  it('weist eine Einheit mit unbekanntem Wohnungstyp zurueck', () => {
    const basis = entwurf();
    const fremd = { ...basis.einheiten[0]!, wohnungstypId: wohnungstypId('T9') };
    const e = erzeugeLiegenschaft(entwurf({ einheiten: [fremd] }));
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.fehler.map((f) => f.code)).toContain('WOHNUNGSTYP_UNBEKANNT');
  });

  it('weist zwei Wohnungstypen mit derselben Zimmerzahl zurueck (US-02)', () => {
    const e = erzeugeLiegenschaft(entwurf({
      wohnungstypen: [
        { id: wohnungstypId('T1'), zimmerzahl: 3.5, parametrisierung },
        { id: wohnungstypId('T2'), zimmerzahl: 3.5, parametrisierung },
      ],
    }));
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.fehler.map((f) => f.code)).toContain('ZIMMERZAHL_MEHRFACH');
  });

  it('weist einen Wohnungstyp ohne Einheit zurueck (US-02)', () => {
    const e = erzeugeLiegenschaft(entwurf({
      wohnungstypen: [
        { id: wohnungstypId('T1'), zimmerzahl: 3.5, parametrisierung },
        { id: wohnungstypId('T2'), zimmerzahl: 4.5, parametrisierung },
      ],
    }));
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.fehler.map((f) => f.code)).toContain('WOHNUNGSTYP_OHNE_EINHEIT');
  });

  it('weist ein Aggregat ohne Einheit zurueck (US-01)', () => {
    const e = erzeugeLiegenschaft(entwurf({ einheiten: [] }));
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.fehler.map((f) => f.code)).toContain('KEINE_EINHEIT');
  });

  it('sammelt mehrere Verstoesse statt beim ersten abzubrechen (US-01)', () => {
    const e = erzeugeLiegenschaft(entwurf({ einheiten: [], wohnungstypen: [
      { id: wohnungstypId('T1'), zimmerzahl: 3.5, parametrisierung },
    ] }));
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.fehler.length).toBeGreaterThanOrEqual(2);
  });
});
