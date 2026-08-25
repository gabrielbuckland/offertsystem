import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validiereKonfiguration } from '@offert/core';
import { bauePipelineDaten } from '../../src/components/pipeline/pipeline-daten.js';
import { PipelineAnsicht } from '../../src/components/pipeline/PipelineAnsicht.js';

function basis() {
  const roh: unknown = JSON.parse(readFileSync(
    new URL('../../../../config/company-defaults.json', import.meta.url), 'utf8'));
  const e = validiereKonfiguration(roh);
  if (!e.ok) throw new Error('Standardkonfiguration muss gueltig sein');
  return e.wert;
}

describe('bauePipelineDaten', () => {
  it('liefert fuenf Stufen und iteriert die Faktoren aus der Konfiguration', () => {
    const stufen = bauePipelineDaten(basis());
    expect(stufen.map((s) => s.nr)).toEqual([1, 2, 3, 4, 5]);
    const faktorStufe = stufen.find((s) => s.nr === 3)!;
    // Datengetrieben (US-09): jeder konfigurierte Faktor erscheint mit seiner
    // Bezeichnung — hier die vier der Standardkonfiguration, ohne dass dieser Test
    // oder die Komponente einen Bezeichner fest verdrahtet.
    expect(faktorStufe.zeilen.length).toBeGreaterThanOrEqual(4);
  });
  it('zeigt ohne Herleitung — statt Zahlen', () => {
    const stufen = bauePipelineDaten(basis());
    const honorar = stufen.find((s) => s.nr === 5)!;
    expect(honorar.zeilen.some((z) => z.wert === '—')).toBe(true);
  });
  it('kennzeichnet ueberschriebene Pfade als projektbezogen', () => {
    const stufen = bauePipelineDaten(basis(), {
      ueberschreibungen: [{ pfad: 'dossierParameter.R1.flaecheInnen',
        defaultwert: null, projektwert: 86 }],
    });
    const eingabe = stufen.find((s) => s.nr === 1)!;
    expect(eingabe.zeilen.some((z) => z.herkunft === 'projekt')).toBe(true);
  });
});

describe('PipelineAnsicht', () => {
  it('verweist je Stufe dezent auf die Einstellungen, ohne dort direkt zu bearbeiten', () => {
    const html = renderToStaticMarkup(
      <PipelineAnsicht stufen={bauePipelineDaten(basis())} />);
    expect(html).toContain('href="/einstellungen/honorar"');
    expect(html).toContain('href="/einstellungen/faktoren"');
    expect(html).toContain('Einstellungen');
    // Die Projektseite fuehrt KEINEN Weg in die Konfiguration ausser dem Verweis — sonst
    // bearbeitete der Vermarkter aus dem Projekt heraus Werte, die auf alle Projekte
    // wirken. Die Einstellungen-Uebersicht selbst bettet die Editoren inzwischen direkt
    // ein (`einstellungen/page.tsx`), statt ueber diese Komponente dorthin zu verlinken.
    expect(html).not.toContain('Bearbeiten');
  });
});
