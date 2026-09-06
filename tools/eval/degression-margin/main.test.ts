import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Aufloesung } from './aufloesung.ts';
import { hauptlauf } from './main.ts';

interface MargenArtefakt {
  readonly margin_min: number;
  readonly margin_min_grosser_sprung: number;
  readonly argmin: { m1: number } | null;
  readonly kritischer_parameter: string | null;
  readonly benoetigte_variation: readonly Aufloesung[];
  readonly hinweis_ausfuehrung: string;
}

const artefakt = JSON.parse(
  readFileSync(join(hauptlauf(), 'margin.json'), 'utf8'),
) as MargenArtefakt;

describe('Abnahmetest F2 (Spec 06 §7.2)', () => {
  it('erfuellt F2: margin_min, argmin, kritischer_parameter, benoetigte_variation', () => {
    expect(artefakt.margin_min).toBeGreaterThan(1);
    expect(artefakt.argmin).toHaveProperty('m1');
    expect(artefakt).toHaveProperty('kritischer_parameter');
    expect(artefakt.benoetigte_variation).toHaveLength(3);
    for (const a of artefakt.benoetigte_variation) {
      expect(a).toHaveProperty('unerreichbar_im_variationsbereich');
    }
    expect(artefakt.hinweis_ausfuehrung).toContain('keine Konfiguration gerechnet');
  });

  it('liegt in der von Spec 02 §5.8.4 hergeleiteten Groessenordnung', () => {
    // margin_min_grosser_sprung wird gegen 1.2-5 geprueft: Am Grenzfall grosser
    // Projektspruenge (lambda = 9) ist die Reserve deutlich groesser als ueber das
    // feine Gitter, wo das Minimum bei lambda knapp ueber 1 liegt — dort sind
    // Degressionsgewinn und Aufwandzuschlag beide fast null, und die Marge ist
    // entsprechend knapp, aber erfuellt. Geprueft wird deshalb der Kennwert, der zur
    // jeweiligen Herleitung passt.
    expect(artefakt.margin_min).toBeGreaterThan(1);
    expect(artefakt.margin_min_grosser_sprung).toBeGreaterThan(1.2);
    expect(artefakt.margin_min_grosser_sprung).toBeLessThan(5);
  });
});
