import { describe, expect, it } from 'vitest';
import { migriereParametrisierung } from '../migriere-bewertungen.ts';

describe('migriereParametrisierung', () => {
  it('fuellt ein leeres Bewertungsobjekt mit den Standardwerten', () => {
    const n = migriereParametrisierung({ zustandsbewertungen: {}, qualitaetsbewertungen: {} });
    expect(n['zustandsbewertungen']).toEqual({
      bathrooms: 'well_maintained', kitchen: 'well_maintained',
      flooring: 'well_maintained', windows: 'well_maintained',
    });
    expect(n['qualitaetsbewertungen']).toEqual({
      bathrooms: 'normal', kitchen: 'normal', flooring: 'normal', windows: 'normal',
    });
  });

  it('bildet die bisherigen deutschen Werte ab', () => {
    const n = migriereParametrisierung({
      zustandsbewertungen: { 'Neu / kürzlich modernisiert': '3' },
      qualitaetsbewertungen: { Gesamteindruck: 'gehoben' },
    });
    expect((n['zustandsbewertungen'] as Record<string, string>)['kitchen'])
      .toBe('new_or_recently_renovated');
    expect((n['qualitaetsbewertungen'] as Record<string, string>)['kitchen'])
      .toBe('high_quality');
  });

  it('laesst uebrige Felder der Parametrisierung unberuehrt', () => {
    const n = migriereParametrisierung({
      flaecheInnen: 86, stockwerk: 1, zustandsbewertungen: {}, qualitaetsbewertungen: {},
    });
    expect(n['flaecheInnen']).toBe(86);
    expect(n['stockwerk']).toBe(1);
  });
});
