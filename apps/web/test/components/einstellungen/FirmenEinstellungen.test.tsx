import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  FirmenEinstellungen,
} from '../../../src/components/einstellungen/FirmenEinstellungen.js';

const FIRMA = JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../../../../../config/company-defaults.json'), 'utf8',
)) as Readonly<Record<string, unknown>>;

describe('FirmenEinstellungen', () => {
  const markup = renderToStaticMarkup(<FirmenEinstellungen anfang={FIRMA} />);

  /**
   * Der Kern von W-6: Vier Entwuerfe hiessen vier Fussleisten. Genau eine
   * Speichern-Schaltflaeche ist der pruefbare Ausdruck davon, dass es genau einen
   * Entwurf gibt — mit `renderToStaticMarkup` ist das Speicherverhalten selbst nicht
   * ausloesbar (kein jsdom im Repo).
   */
  it('fuehrt genau eine Fussleiste fuer die ganze Ebene', () => {
    expect(markup.split('Speichern').length - 1).toBe(1);
    expect(markup.split('Verwerfen').length - 1).toBe(1);
  });

  it('fuehrt genau einen Darstellungs-Umschalter', () => {
    expect(markup.split('aria-label="Darstellung"').length - 1).toBe(1);
  });

  it('zeigt alle vier Bereichskarten in Pipeline-Reihenfolge', () => {
    // R-3: `renderToStaticMarkup` HTML-escaped das Kaufmanns-Und in
    // BEREICHE.preisanpassung.titel ("Preisanpassung & Vorlagen") zu "&amp;" — die
    // rohe Textform kommt im Markup nicht vor, die escapte schon.
    const positionen = ['Dossier-Voreinstellungen', 'Preisanpassung &amp; Vorlagen',
      'Aufwandfaktoren', 'Honorar'].map((t) => markup.indexOf(t));
    expect(positionen.every((p) => p >= 0)).toBe(true);
    expect([...positionen].sort((a, b) => a - b)).toEqual(positionen);
  });
});
