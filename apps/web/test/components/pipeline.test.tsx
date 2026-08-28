import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validiereKonfiguration } from '@offert/core';
import { formatiereAggregat, formatiereScore } from '@offert/offer/src/format/de-ch.js';
import {
  bauePipelineDaten, type PipelineStufe, type PipelineZeile,
} from '../../src/components/pipeline/pipeline-daten.js';
import { PipelineAnsicht } from '../../src/components/pipeline/PipelineAnsicht.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

function basis() {
  const roh: unknown = JSON.parse(readFileSync(
    new URL('../../../../config/company-defaults.json', import.meta.url), 'utf8'));
  const e = validiereKonfiguration(roh);
  if (!e.ok) throw new Error('Standardkonfiguration muss gueltig sein');
  return e.wert;
}

function alleZeilen(stufe: PipelineStufe): readonly PipelineZeile[] {
  return stufe.abschnitte.flatMap((a) => a.zeilen ?? []);
}

/** Herleitung aus der echten Beispiel-Offerte (offerte-bauer.ts): derselbe Kern, dieselbe
 *  Konfiguration — die Formelzeilen muessen exakt die Kernwerte ausweisen (I-24). */
function herleitung() {
  const offerte = baueBeispielOfferte();
  return { derivation: offerte.derivation, aggregates: offerte.aggregates };
}

describe('bauePipelineDaten', () => {
  it('liefert fuenf Stufen in Rechenreihenfolge und iteriert die Faktoren aus der Konfiguration', () => {
    const stufen = bauePipelineDaten(basis());
    expect(stufen.map((s) => s.nr)).toEqual([1, 2, 3, 4, 5]);
    const faktorStufe = stufen.find((s) => s.nr === 3)!;
    // Datengetrieben (US-09): jeder konfigurierte Faktor erscheint mit seiner
    // Bezeichnung — hier die drei der Standardkonfiguration (seit 1.1.0 ohne
    // manuellen Faktor, config/README.md), ohne dass dieser Test
    // oder die Komponente einen Bezeichner fest verdrahtet.
    expect(alleZeilen(faktorStufe).length).toBeGreaterThanOrEqual(3);
  });

  it('zeigt ohne Herleitung — statt Zahlen', () => {
    const stufen = bauePipelineDaten(basis());
    const honorar = stufen.find((s) => s.nr === 5)!;
    expect(alleZeilen(honorar).some((z) => z.wert === '—')).toBe(true);
  });

  it('kennzeichnet ueberschriebene Pfade als projektbezogen', () => {
    const stufen = bauePipelineDaten(basis(), {
      ueberschreibungen: [{ pfad: 'dossierParameter.R1.flaecheInnen',
        defaultwert: null, projektwert: 86 }],
    });
    const eingabe = stufen.find((s) => s.nr === 1)!;
    expect(alleZeilen(eingabe).some((z) => z.herkunft === 'projekt')).toBe(true);
  });

  it('weist mit Herleitung je Einheit eine Rechenzeile und die Kern-Verkaufssumme aus', () => {
    const h = herleitung();
    const stufen = bauePipelineDaten(basis(), { herleitung: h });
    const verkauf = stufen.find((s) => s.nr === 2)!;

    // Je Wohnungstyp und je Einheit genau eine Tabellenzeile — der Rechenweg zeigt jede
    // Einheit einzeln, nicht nur ein Beispiel (Nachvollziehbarkeit, US-09).
    const tabellen = verkauf.abschnitte.flatMap((a) => (a.tabelle === undefined ? [] : [a.tabelle]));
    expect(tabellen.map((t) => t.zeilen.length)).toEqual([
      h.derivation.apartmentTypes.length,
      h.derivation.units.length,
    ]);

    // Das Stufenergebnis ist der WERT des Kerns, nicht eine eigene Rechnung (I-24).
    const v = alleZeilen(verkauf).find((z) => z.hervorgehoben === true)!;
    expect(v.wert).toBe(formatiereAggregat(h.aggregates.totalSalesValue.value));
  });

  it('setzt in Stufe 5 die Werte der Stufenwahl und die gerundete Honorarrange des Kerns ein', () => {
    const h = herleitung();
    const stufen = bauePipelineDaten(basis(), { herleitung: h });
    const zeilen = alleZeilen(stufen.find((s) => s.nr === 5)!);

    expect(zeilen.find((z) => z.beschriftung === 'Stufenwahl k')?.wert)
      .toBe(`k = ${String(h.aggregates.feeTier.value.k)}`);
    expect(zeilen.find((z) => z.beschriftung === 'Honorar min')?.wert)
      .toBe(formatiereAggregat(h.aggregates.feeRange.value.min));
    expect(zeilen.find((z) => z.beschriftung === 'Honorar max')?.wert)
      .toBe(formatiereAggregat(h.aggregates.feeRange.value.max));
  });

  it('weist bei uebersteuertem D den abgeleiteten und den wirksamen Wert getrennt aus', () => {
    const h = herleitung();
    const stufen = bauePipelineDaten(basis(), {
      herleitung: h, aufwandindikatorUebersteuert: true,
    });
    const zeilen = alleZeilen(stufen.find((s) => s.nr === 4)!);

    const abgeleitet = h.aggregates.effortFactors.reduce((s, ef) => s + ef.beitrag, 0);
    expect(zeilen.find((z) => z.beschriftung === 'D aus den Faktoren abgeleitet')?.wert)
      .toBe(formatiereScore(abgeleitet));
    expect(zeilen.find((z) => z.beschriftung === 'Aufwandindikator D')?.wert)
      .toBe(formatiereScore(h.aggregates.effortIndicator.value));
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

  it('rendert mit Herleitung die Formelzeilen der Honorarstufe', () => {
    const html = renderToStaticMarkup(
      <PipelineAnsicht stufen={bauePipelineDaten(basis(), { herleitung: herleitung() })} />);
    expect(html).toContain('Stufenwahl k');
    expect(html).toContain('Skalierung g(D)');
    expect(html).toContain('÷');
  });
});
