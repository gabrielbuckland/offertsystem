import { describe, expect, it } from 'vitest';
import {
  CFG_CODES,
  CFG_EBENE,
  fehler,
  istKonfigurationsFehler,
} from '../../src/config/fehlercodes.js';

describe('CFG-Namensraum', () => {
  it('deckt alle 25 Ladezeitcodes aus Spec 02 §3.0 ab', () => {
    // 24 + `CFG_MERKMAL_DUPLICATE` (Review-Finding 6, Ebene 3): Ebene 3 prueft seither auch
    // die Merkmalsliste auf doppelte Kennungen, analog zur bestehenden Pruefung doppelter
    // Vorlagenbezeichner in `pruefeAnpassungsVorlagen`.
    expect(CFG_CODES).toHaveLength(25);
    expect(new Set(CFG_CODES).size).toBe(25);
    for (const code of CFG_CODES) expect(code.startsWith('CFG_')).toBe(true);
  });

  it('ordnet jedem Code genau eine Pruefebene zu', () => {
    for (const code of CFG_CODES) expect([1, 2, 3]).toContain(CFG_EBENE[code]);
    expect(CFG_EBENE['CFG_SCHEMA_UNKNOWN_KEY']).toBe(1);
    expect(CFG_EBENE['CFG_ALPHA_RANGE']).toBe(2);
    expect(CFG_EBENE['CFG_NET_DEGRESSION']).toBe(3);
  });

  it('erzeugt Fehler mit strukturierten Parametern statt Fliesstext', () => {
    const f = fehler('CFG_ALPHA_RANGE', 'flaeche.alpha', { wert: 1.4 });
    expect(f).toEqual({
      code: 'CFG_ALPHA_RANGE',
      ebene: 2,
      pfad: 'flaeche.alpha',
      parameter: { wert: 1.4 },
    });
    expect(istKonfigurationsFehler(f)).toBe(true);
    expect(istKonfigurationsFehler({ code: 'CFG_UNBEKANNT' })).toBe(false);
  });
});
