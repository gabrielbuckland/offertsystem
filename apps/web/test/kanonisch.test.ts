import { describe, expect, it } from 'vitest';
import { bildePruefsumme, kanonischSerialisieren } from '../src/server/kanonisch.js';

describe('kanonische Serialisierung', () => {
  it('ordnet Schluessel unabhaengig von der Einfuegereihenfolge', () => {
    expect(kanonischSerialisieren({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(kanonischSerialisieren({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it('erhaelt die Reihenfolge von Listen', () => {
    expect(kanonischSerialisieren([3, 1, 2])).toBe('[3,1,2]');
  });

  it('serialisiert null und verschachtelte Strukturen', () => {
    expect(kanonischSerialisieren({ z: null, a: { y: [1, { x: true }] } }))
      .toBe('{"a":{"y":[1,{"x":true}]},"z":null}');
  });

  it('liefert fuer gleiche Inhalte dieselbe Pruefsumme', () => {
    const links = bildePruefsumme({ b: 1, a: [1, 2] });
    const rechts = bildePruefsumme({ a: [1, 2], b: 1 });
    expect(links).toBe(rechts);
    expect(links).toMatch(/^[0-9a-f]{64}$/);
  });

  it('liefert fuer verschiedene Inhalte verschiedene Pruefsummen', () => {
    expect(bildePruefsumme({ a: 1 })).not.toBe(bildePruefsumme({ a: 2 }));
  });
});
