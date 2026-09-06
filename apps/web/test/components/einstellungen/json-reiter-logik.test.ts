import { describe, expect, it } from 'vitest';
import { GESPERRTE_PFADE } from '@offert/core';
import {
  alsText, ausText, mitWurzeln, ohneWurzeln,
} from '../../../src/components/einstellungen/json-reiter-logik.js';

describe('alsText', () => {
  it('serialisiert mit zwei Leerzeichen Einrueckung', () => {
    expect(alsText({ flaeche: { alpha: 0.5 } }))
      .toBe(JSON.stringify({ flaeche: { alpha: 0.5 } }, null, 2));
  });
});

describe('ausText', () => {
  it('liest ein gueltiges Objekt', () => {
    expect(ausText('{"flaeche":{"alpha":0.6}}'))
      .toEqual({ ok: true, wert: { flaeche: { alpha: 0.6 } } });
  });

  it('meldet kaputtes JSON als Befund statt zu werfen', () => {
    const ergebnis = ausText('{');
    expect(ergebnis.ok).toBe(false);
    expect(!ergebnis.ok && ergebnis.text).toMatch(/kein gültiges JSON/i);
  });

  it('lehnt ein Array an der Wurzel ab', () => {
    const ergebnis = ausText('[1, 2, 3]');
    expect(ergebnis.ok).toBe(false);
    expect(!ergebnis.ok && ergebnis.text).toMatch(/kein gültiges JSON/i);
  });

  it('lehnt einen Skalar an der Wurzel ab', () => {
    const ergebnis = ausText('42');
    expect(ergebnis.ok).toBe(false);
    expect(!ergebnis.ok && ergebnis.text).toMatch(/kein gültiges JSON/i);
  });

  it('uebersteht einen Rundlauf ueber alsText', () => {
    const wert = { honorar: { gMin: 0.85 }, liste: [1, 2, 3] };
    expect(ausText(alsText(wert))).toEqual({ ok: true, wert });
  });
});

// W-1: Wurzelliste kommt aus dem Kern; eine Wahrheit über unveränderliche Roots.
describe('ohneWurzeln / mitWurzeln', () => {
  const bestand = {
    api: { baseUrl: 'https://echt.example', timeoutMs: 5000 },
    meta: { schemaVersion: 1 },
    honorar: { gMin: 0.85 },
  };

  it('blendet die gesperrten Wurzeln aus der Sicht aus', () => {
    const sicht = ohneWurzeln(bestand, GESPERRTE_PFADE);
    expect(Object.keys(sicht)).toEqual(['honorar']);
  });

  it('setzt die gesperrten Wurzeln beim Zurueckschreiben unveraendert wieder ein', () => {
    const bearbeitet = { honorar: { gMin: 0.9 } };
    expect(mitWurzeln(bearbeitet, bestand, GESPERRTE_PFADE)).toEqual({
      honorar: { gMin: 0.9 },
      api: bestand.api,
      meta: bestand.meta,
    });
  });

  it('verwirft einen im Rohtext eingetippten gesperrten Schluessel', () => {
    // Sperre nicht blosse UI-Kosmetik; Schreibroute muss sie auch durchsetzen.
    const bearbeitet = { honorar: { gMin: 0.9 }, api: { baseUrl: 'https://fremd.example' } };
    expect(mitWurzeln(bearbeitet, bestand, GESPERRTE_PFADE)['api']).toEqual(bestand.api);
  });
});
