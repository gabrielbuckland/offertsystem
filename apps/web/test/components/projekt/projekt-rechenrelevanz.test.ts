import { describe, expect, it } from 'vitest';
import { nurRechenirrelevanteFelderGeaendert } from
  '../../../src/components/projekt/projekt-rechenrelevanz.js';

const BASIS = {
  schemaVersion: 1, id: 'p1',
  adresse: { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' },
  referenzobjekte: [], anpassungsSpalten: [], merkmale: [], einheiten: [],
  aufwandfaktoren: {},
  meta: { erstelltAm: 't0', geaendertAm: 't0' },
} as const;

describe('nurRechenirrelevanteFelderGeaendert (I-1)', () => {
  it('ist wahr bei identischen Staenden', () => {
    expect(nurRechenirrelevanteFelderGeaendert(BASIS as never, BASIS as never)).toBe(true);
  });

  it('ist wahr, wenn sich nur offertText aendert', () => {
    const nachher = { ...BASIS, offertText: { type: 'doc', content: [] } };
    expect(nurRechenirrelevanteFelderGeaendert(BASIS as never, nachher as never)).toBe(true);
  });

  it('ist wahr, wenn sich nur auftraggeber aendert', () => {
    const nachher = { ...BASIS, auftraggeber: 'Muster Immobilien AG' };
    expect(nurRechenirrelevanteFelderGeaendert(BASIS as never, nachher as never)).toBe(true);
  });

  it('ist wahr, wenn sich offertText UND auftraggeber gleichzeitig aendern', () => {
    const nachher = {
      ...BASIS, auftraggeber: 'Muster Immobilien AG',
      offertText: { type: 'doc', content: [] },
    };
    expect(nurRechenirrelevanteFelderGeaendert(BASIS as never, nachher as never)).toBe(true);
  });

  it('ist falsch, wenn sich ein rechenrelevantes Feld aendert (aufwandfaktoren)', () => {
    const nachher = { ...BASIS, aufwandfaktoren: { innenausbau_qualitaet: 3 } };
    expect(nurRechenirrelevanteFelderGeaendert(BASIS as never, nachher as never)).toBe(false);
  });

  it('ist falsch, wenn ein rechenrelevantes UND ein irrelevantes Feld gleichzeitig '
    + 'aendern', () => {
    const nachher = {
      ...BASIS, aufwandfaktoren: { innenausbau_qualitaet: 3 },
      offertText: { type: 'doc', content: [] },
    };
    expect(nurRechenirrelevanteFelderGeaendert(BASIS as never, nachher as never)).toBe(false);
  });

  it('ist falsch, wenn sich die Einheiten aendern', () => {
    const nachher = {
      ...BASIS,
      einheiten: [{
        id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
        flaecheInnen: 86, flaecheAussen: 19, spaltenwerte: {}, merkmalswerte: {},
      }],
    };
    expect(nurRechenirrelevanteFelderGeaendert(BASIS as never, nachher as never)).toBe(false);
  });
});
