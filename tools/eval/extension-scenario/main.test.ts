import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hauptlauf, vergleicheMargen } from './main.ts';

describe('Margenvergleich nach der Renormalisierung', () => {
  it('die Marge waechst, weil w_umfang sinkt', () => {
    const v = vergleicheMargen();
    expect(v.w_umfang_nachher).toBeLessThan(v.w_umfang_vorher);
    expect(v.margin_min_nachher).toBeGreaterThanOrEqual(v.margin_min_vorher);
    expect(v.richtung_wie_erwartet).toBe(true);
    expect(v.beide_erfuellt).toBe(true);
  });
});

describe('Artefakt des Erweiterungsszenarios', () => {
  it('weist die verletzende Variante als zurueckgewiesen aus und rechnet die erweiterte durch', () => {
    const artefakt = JSON.parse(
      readFileSync(join(hauptlauf(), 'szenario.json'), 'utf8'),
    ) as {
      validierung_erweitert: { ok: boolean };
      validierung_verletzend: { zurueckgewiesen: boolean };
      rechenprobe: readonly { szenario_id: string; ok: boolean }[];
    };
    expect(artefakt.validierung_erweitert.ok).toBe(true);
    expect(artefakt.validierung_verletzend.zurueckgewiesen).toBe(true);
    expect(artefakt.rechenprobe.length).toBeGreaterThan(0);
  });
});
