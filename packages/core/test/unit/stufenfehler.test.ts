import { describe, expect, it } from 'vitest';
import { fehlschlag, ok } from '../../src/domain/result.js';
import { stufenFehler } from '../../src/fehler/stufenfehler.js';
import { wohnungsnummer } from '../../src/domain/ids.js';

describe('Result statt Exceptions (Spec 03 §3.5)', () => {
  it('unterscheidet Erfolg und Fehlschlag als Wert', () => {
    const e = ok(42);
    expect(e.ok).toBe(true);
    if (e.ok) expect(e.wert).toBe(42);
    const f = fehlschlag('x');
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.fehler).toBe('x');
  });
});

describe('StufenFehler (E-03)', () => {
  it('traegt Code und strukturierte Parameter, aber keinen Fliesstext', () => {
    const f = stufenFehler(2, 'ANPASSUNG_UNZULAESSIG',
      { wohnungsnummer: 'A-01', zSumme: -1.2, art: 'modellgrenze' },
      { einheit: wohnungsnummer('A-01') });
    expect(f.code).toBe('ANPASSUNG_UNZULAESSIG');
    expect(f.stufe).toBe(2);
    expect(f.parameter['art']).toBe('modellgrenze');
    expect(Object.keys(f)).not.toContain('meldung');
    expect(f.bezug?.einheit).toBe('A-01');
  });

  it('friert die Parameter ein — keine Mutation nachgelagerter Schichten', () => {
    const f = stufenFehler(4, 'GEWICHTSSUMME_UNGUELTIG', { summe: 0.9 });
    expect(Object.isFrozen(f)).toBe(true);
    expect(Object.isFrozen(f.parameter)).toBe(true);
  });
});
