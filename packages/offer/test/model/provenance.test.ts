import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  HERKUNFT_BESCHRIFTUNG,
  herkunft,
  provenancedSchema,
} from '../../src/model/provenance.js';

describe('Provenanced', () => {
  it('bindet den Herkunftsparameter literal', () => {
    const wert = herkunft(1_250_000, 'pricehubble');
    expect(wert).toEqual({ value: 1_250_000, provenance: 'pricehubble' });
    // @ts-expect-error — 'marketer-adjustment' ist an dieser Stelle nicht zulaessig
    const falsch: typeof wert = herkunft(1, 'marketer-adjustment');
    expect(falsch.provenance).toBe('marketer-adjustment');
  });

  it('haelt fuer jede der vier Klassen eine Beschriftung bereit', () => {
    expect(HERKUNFT_BESCHRIFTUNG).toEqual({
      'pricehubble': 'Bewertung PriceHubble',
      'local-derivation': 'systemseitige Ableitung',
      'marketer-adjustment': 'Anpassung Vermarkter',
      'local-calculation': 'lokale Kalkulation',
    });
  });
});

describe('provenancedSchema', () => {
  const schema = provenancedSchema(z.number(), 'pricehubble');

  it('nimmt den passenden Literalwert an', () => {
    expect(schema.parse({ value: 12, provenance: 'pricehubble' }).provenance)
      .toBe('pricehubble');
  });

  it('weist eine fehlende Herkunftsangabe zurueck, statt sie zu ergaenzen', () => {
    expect(() => schema.parse({ value: 12 })).toThrow();
  });

  it('weist eine fremde Herkunftsklasse zurueck', () => {
    expect(() => schema.parse({ value: 12, provenance: 'local-calculation' })).toThrow();
  });

  it('bietet keine Funktion, die zwei Herkunftsklassen zu einem Wert verrechnet', async () => {
    const modul = await import('../../src/model/provenance.js');
    const namen = Object.keys(modul);
    expect(namen).toEqual(
      expect.arrayContaining(['herkunft', 'provenancedSchema', 'HERKUNFT_BESCHRIFTUNG']),
    );
    expect(namen.filter((n) => /summ|addier|verrechne|merge/i.test(n))).toEqual([]);
  });
});
