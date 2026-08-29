import { describe, expect, it } from 'vitest';
import { alsText, ausText } from '../../../src/components/einstellungen/json-reiter-logik.js';

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
