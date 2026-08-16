import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoWurzel } from '../shared/artefakt.ts';
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

describe('Kopplung von Runbook und Messskript', () => {
  it('das Runbook nennt dieselben Tags wie das Messskript', () => {
    // Ein Runbook, das andere Pfade erlaubt als der Messfilter, fuehrt zur verweigerten
    // Messung am Tag der Durchfuehrung.
    const text = readFileSync(
      join(repoWurzel(), 'docs', 'testdoku', 'erweiterung-risikoindex.md'), 'utf8');
    for (const tag of [
      'eval/ff1b-vorher', 'eval/ff1b-nachher',
      'eval/ff1b-strategie-vorher', 'eval/ff1b-strategie-nachher',
    ]) {
      expect(text, `Tag ${tag} fehlt im Runbook`).toContain(tag);
    }
    expect(text).toContain('packages/core/src/normalization/**');
  });
});
