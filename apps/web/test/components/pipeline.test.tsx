import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mergeKonfiguration, validiereKonfiguration } from '@offert/core';
import { formatiereAggregat, formatiereScore } from '@offert/offer';
import { PipelineAnsicht } from '../../src/components/pipeline/PipelineAnsicht.js';
import {
  bauePipelineDaten, istProjektbezogen, type PipelineStufe, type PipelineZeile,
} from '../../src/components/pipeline/pipeline-daten.js';
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

// I-24: Formelzeilen müssen Kernwerte exakt ausweisen.
function herleitung() {
  const offerte = baueBeispielOfferte();
  return { derivation: offerte.derivation, aggregates: offerte.aggregates };
}

function zeile(stufe: PipelineStufe, beschriftung: string): PipelineZeile {
  const treffer = alleZeilen(stufe).find((z) => z.beschriftung === beschriftung);
  if (treffer === undefined) throw new Error(`Zeile «${beschriftung}» fehlt in Stufe ${String(stufe.nr)}`);
  return treffer;
}

// Stufe 1: je Bewertungsobjekt ein Abschnitt; Feldbeschriftung über Abschnittstitel ansprechen.
function zeileImAbschnitt(
  stufe: PipelineStufe, abschnittstitel: string, beschriftung: string,
): PipelineZeile {
  const abschnitt = stufe.abschnitte.find((a) => a.titel === abschnittstitel);
  const treffer = abschnitt?.zeilen?.find((z) => z.beschriftung === beschriftung);
  if (treffer === undefined) {
    throw new Error(`Zeile «${abschnittstitel} / ${beschriftung}» fehlt in Stufe ${String(stufe.nr)}`);
  }
  return treffer;
}

// Projekt-Delta mit Überschreibungen aus echtem Zwei-Ebenen-Merge; nicht per Hand geschrieben.
function mitProjektDelta() {
  const firma = basis();
  const bestehenderFaktor = Object.keys(firma.aufwandfaktoren).sort((a, b) => a.localeCompare(b))[0]!;
  const neuerFaktor = 'projekt_laerm';
  const ergebnis = mergeKonfiguration(firma, {
    dossierDefaults: { zustandsbewertungen: { kitchen: 'well_maintained' } },
    flaeche: { alpha: 0.9 },
    honorar: { skalierung: { gMin: 0.9 } },
    aufwandfaktoren: {
      [bestehenderFaktor]: { gewicht: 0.4 },
      [neuerFaktor]: {
        bezeichnung: 'Lärmbelastung', quelle: 'manuell', quellSchluessel: neuerFaktor,
        strategie: 'minmax', min: 0, max: 1, gewicht: 0.1,
      },
    },
  });
  if (!ergebnis.ok) throw new Error('Delta des Nachreviews muss zusammenfuehrbar sein');
  return {
    basis: ergebnis.wert.basis,
    ueberschreibungen: ergebnis.wert.ueberschreibungen,
    bestehenderFaktor,
    neuerFaktor,
  };
}

describe('bauePipelineDaten', () => {
  it('liefert fuenf Stufen in Rechenreihenfolge und iteriert die Faktoren aus der Konfiguration', () => {
    const stufen = bauePipelineDaten(basis());
    expect(stufen.map((s) => s.nr)).toEqual([1, 2, 3, 4, 5]);
    const faktorStufe = stufen.find((s) => s.nr === 3)!;
    // US-09: datengetrieben, keine fest verdrahteten Bezeichner.
    expect(alleZeilen(faktorStufe).length).toBeGreaterThanOrEqual(3);
  });

  it('zeigt ohne Herleitung — statt Zahlen', () => {
    const stufen = bauePipelineDaten(basis());
    const honorar = stufen.find((s) => s.nr === 5)!;
    expect(alleZeilen(honorar).some((z) => z.wert === '—')).toBe(true);
  });

  it('kennzeichnet ueberschriebene Pfade als projektbezogen', () => {
    const firma = basis();
    const zustand = firma.dossierDefaults.zustandsbewertungen;
    const stufen = bauePipelineDaten(firma, {
      ueberschreibungen: [{
        pfad: 'dossierParameter.R1.zustandsbewertungen',
        defaultwert: zustand,
        projektwert: { ...zustand, kitchen: 'new_or_recently_renovated' },
      }],
    });
    const eingabe = stufen.find((s) => s.nr === 1)!;
    expect(alleZeilen(eingabe).some((z) => z.herkunft === 'projekt')).toBe(true);
  });

  it('weist eine uebersteuerte Dossier-Voreinstellung in Stufe 1 als projektbezogen aus', () => {
    const delta = mitProjektDelta();
    const stufen = bauePipelineDaten(delta.basis, { ueberschreibungen: delta.ueberschreibungen });
    const eingabe = stufen.find((s) => s.nr === 1)!;

    // `dossierDefaults.zustandsbewertungen.kitchen` steht im Protokoll — die Zeile muss es zeigen.
    expect(zeileImAbschnitt(eingabe, 'Zustandsbewertungen', 'Küche').herkunft).toBe('projekt');
    // Gegenprobe: nicht uebersteuerte Felder bleiben firmenweit, die Anzeige faerbt
    // nicht pauschal ein, sobald irgendein Delta vorliegt.
    expect(zeileImAbschnitt(eingabe, 'Zustandsbewertungen', 'Badezimmer').herkunft).toBe('firmenweit');
    expect(zeileImAbschnitt(eingabe, 'Qualitätsbewertungen', 'Küche').herkunft).toBe('firmenweit');
  });

  it('weist die uebersteuerten Parameter der Stufen 2 und 5 als projektbezogen aus', () => {
    const delta = mitProjektDelta();
    const stufen = bauePipelineDaten(delta.basis, { ueberschreibungen: delta.ueberschreibungen });

    const verkauf = stufen.find((s) => s.nr === 2)!;
    expect(zeile(verkauf, 'Gewicht der Aussenfläche α').herkunft).toBe('projekt');
    expect(zeile(verkauf, 'Zulässige Zu-/Abschlagssumme je Einheit').herkunft).toBe('firmenweit');

    // Ein Protokolleintrag `honorar.skalierung.gMin` muss die Zeile treffen, die den
    // Skalierungsbereich zeigt — der Eintrag ist feiner als die Zeile.
    const honorar = stufen.find((s) => s.nr === 5)!;
    // Protokoll-Eintrag feiner/gleich/gröber als Zeile-Pfad muss treffen.
    expect(zeile(honorar, 'Skalierungsbereich g').herkunft).toBe('projekt');
    expect(zeile(honorar, 'Honorarstaffel').herkunft).toBe('firmenweit');
  });

  it('weist uebersteuerte Aufwandfaktoren in der Stufe ihres angezeigten Werts aus', () => {
    const delta = mitProjektDelta();
    const stufen = bauePipelineDaten(delta.basis, { ueberschreibungen: delta.ueberschreibungen });
    const skalen = stufen.find((s) => s.nr === 3)!;
    const beitraege = stufen.find((s) => s.nr === 4)!;
    const bestehend = delta.basis.aufwandfaktoren[delta.bestehenderFaktor]!.bezeichnung;
    const neu = delta.basis.aufwandfaktoren[delta.neuerFaktor]!.bezeichnung;

    // Übersteuert ist Gewicht: Beitragszeile ja, Skalenzeile nein.
    expect(zeile(beitraege, bestehend).herkunft).toBe('projekt');
    expect(zeile(skalen, bestehend).herkunft).toBe('firmenweit');

    // Neuer Faktor: ganzer Teilbaum im Protokoll trifft beide Zeilen.
    expect(zeile(skalen, neu).herkunft).toBe('projekt');
    expect(zeile(beitraege, neu).herkunft).toBe('projekt');
  });

  it('weist mit Herleitung je Einheit eine Rechenzeile und die Kern-Verkaufssumme aus', () => {
    const h = herleitung();
    const stufen = bauePipelineDaten(basis(), { herleitung: h });
    const verkauf = stufen.find((s) => s.nr === 2)!;

    // US-09: je Wohnungstyp/Einheit eine Zeile, Nachvollziehbarkeit.
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

describe('istProjektbezogen', () => {
  function protokoll(...pfade: readonly string[]) {
    return pfade.map((pfad) => ({ pfad, defaultwert: null, projektwert: 1 }));
  }

  it('trifft einen Eintrag, der feiner oder groeber ist als der Bezugspfad der Zeile', () => {
    expect(istProjektbezogen(['honorar.skalierung.gMin'], protokoll('honorar.skalierung.gMin')))
      .toBe(true);
    expect(istProjektbezogen(['honorar.skalierung.gMin'], protokoll('honorar'))).toBe(true);
    expect(istProjektbezogen(['honorar.skalierung'], protokoll('honorar.skalierung.gMax')))
      .toBe(true);
    expect(istProjektbezogen(['honorar.skalierung.gMin'], protokoll('honorar.stuetzstellen')))
      .toBe(false);
  });

  it('erkennt das Sternsegment nur als GENAU ein Segment', () => {
    expect(istProjektbezogen(['dossierParameter.*.stockwerk'],
      protokoll('dossierParameter.typ_3_5.stockwerk'))).toBe(true);
    expect(istProjektbezogen(['dossierParameter.*.stockwerk'],
      protokoll('dossierParameter.typ_3_5.flaecheInnen'))).toBe(false);
  });

  it('weist eine gesperrte Wurzel nie als projektbezogen aus', () => {
    // api in GESPERRTE_PFADE; Anzeige darf nie bestätigen.
    expect(istProjektbezogen(['api.baseUrl'], protokoll('api.baseUrl'))).toBe(false);
    expect(istProjektbezogen(['meta.konfigVersion'], protokoll('meta'))).toBe(false);
  });

  it('meldet ohne Protokoll nichts als projektbezogen', () => {
    expect(istProjektbezogen(['flaeche.alpha'], undefined)).toBe(false);
    expect(istProjektbezogen(['flaeche.alpha'], [])).toBe(false);
  });

  it('keine Zeile verdrahtet ihre Herkunft fest', () => {
    // K-2: Herkunft als Literal würde Protokoll ignorieren; Rückfall-Schutz.
    const quelle = readFileSync(
      new URL('../../src/components/pipeline/pipeline-daten.ts', import.meta.url), 'utf8');
    expect(quelle).not.toContain("herkunft: 'firmenweit'");
    expect(quelle).not.toContain("herkunft: 'projekt'");
  });
});

describe('PipelineAnsicht', () => {
  it('bearbeitet die Konfiguration nicht direkt aus dem Projekt heraus', () => {
    const html = renderToStaticMarkup(
      <PipelineAnsicht stufen={bauePipelineDaten(basis())} />);
    // Kein Weg in Konfiguration ausser Verweis; verhindert projektübergreifende Änderungen.
    expect(html).not.toContain('Bearbeiten');
  });
});
