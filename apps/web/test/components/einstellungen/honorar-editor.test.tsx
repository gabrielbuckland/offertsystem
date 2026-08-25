import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HonorarEditor } from '../../../src/components/einstellungen/HonorarEditor.js';
import type { VerwendeEinstellungenErgebnis } from '../../../src/components/einstellungen/verwende-einstellungen.js';

const PFAD = resolve(import.meta.dirname, '../../../../../config/company-defaults.json');
const STANDARD = JSON.parse(readFileSync(PFAD, 'utf8')) as Record<string, unknown>;

/** Minimaler, unbenutzter Zustand — `HonorarEditor` liest hier nur `entwurf`/`befunde`. */
function baueZustand(
  entwurf: Record<string, unknown>,
  befunde: readonly { readonly pfad: string; readonly text: string }[] = [],
): VerwendeEinstellungenErgebnis {
  return {
    entwurf,
    geaendert: false,
    speichert: false,
    pruefsumme: undefined,
    befunde,
    aendere: () => {},
    speichere: () => {},
    verwerfe: () => {},
  };
}

describe('HonorarEditor', () => {
  it('zeigt je Stuetzstelle eine Zeile mit drei Zahlenfeldern, Entfernen- und Hinzufuegen-Schaltflaeche', () => {
    const stuetzstellen = (STANDARD['honorar'] as { stuetzstellen: readonly unknown[] }).stuetzstellen;
    const html = renderToStaticMarkup(<HonorarEditor einstellungen={baueZustand(STANDARD)} />);

    // Drei Zahlenfelder je Stuetzstelle (V-Grenze, H_min, H_max).
    const zahlenfelder = html.match(/type="number"/g) ?? [];
    // + 2 fuer gMin/gMax.
    expect(zahlenfelder.length).toBe(stuetzstellen.length * 3 + 2);

    const entfernenTreffer = html.match(/entfernen/g) ?? [];
    expect(entfernenTreffer.length).toBe(stuetzstellen.length);

    expect(html).toContain('Stützstelle hinzufügen');
  });

  it('zeigt gMin/gMax-Felder der Skalierungsfunktion', () => {
    const html = renderToStaticMarkup(<HonorarEditor einstellungen={baueZustand(STANDARD)} />);
    expect(html).toMatch(/g\s*min/i);
    expect(html).toMatch(/g\s*max/i);
  });

  it('verankert einen Befund zu honorar.stuetzstellen[1].hMin an Zeile 2, nicht in einer Sammelliste', () => {
    const stuetzstellenArr = (STANDARD['honorar'] as {
      stuetzstellen: readonly { v: number; hMin: number; hMax: number }[];
    }).stuetzstellen;
    const zeile2 = stuetzstellenArr[1]!;
    const zeile3 = stuetzstellenArr[2];

    const befunde = [{ pfad: 'honorar.stuetzstellen[1].hMin', text: 'Degression verletzt.' }];
    const html = renderToStaticMarkup(<HonorarEditor einstellungen={baueZustand(STANDARD, befunde)} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Degression verletzt.');

    // Der Hinweis muss NACH dem letzten Feld der zweiten Zeile (Index 1) und VOR dem
    // ersten Feld der dritten Zeile erscheinen — d.h. an der verursachenden Zeile,
    // nicht gesammelt am Ende einer Liste.
    const alertIndex = html.indexOf('role="alert"');
    const endeZeile2 = html.indexOf(`value="${zeile2.hMax / 100}"`);
    expect(endeZeile2).toBeGreaterThan(-1);
    expect(alertIndex).toBeGreaterThan(endeZeile2);
    if (zeile3 !== undefined) {
      const beginnZeile3 = html.indexOf(`value="${zeile3.v / 100}"`);
      expect(beginnZeile3).toBeGreaterThan(-1);
      expect(alertIndex).toBeLessThan(beginnZeile3);
    }
  });
});
