import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mergeKonfiguration, validiereKonfiguration } from '@offert/core';
import { formatiereAggregat, formatiereScore } from '@offert/offer/src/format/de-ch.js';
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

/** Herleitung aus der echten Beispiel-Offerte (offerte-bauer.ts): derselbe Kern, dieselbe
 *  Konfiguration — die Formelzeilen muessen exakt die Kernwerte ausweisen (I-24). */
function herleitung() {
  const offerte = baueBeispielOfferte();
  return { derivation: offerte.derivation, aggregates: offerte.aggregates };
}

function zeile(stufe: PipelineStufe, beschriftung: string): PipelineZeile {
  const treffer = alleZeilen(stufe).find((z) => z.beschriftung === beschriftung);
  if (treffer === undefined) throw new Error(`Zeile «${beschriftung}» fehlt in Stufe ${String(stufe.nr)}`);
  return treffer;
}

/**
 * Projekt-Delta, das in jeder projektbezogen uebersteuerbaren Wurzel eingreift, die der
 * Rechenweg anzeigt: eine Dossier-Voreinstellung, ein Flaechenparameter, ein
 * Honorarparameter, das Gewicht eines bestehenden Aufwandfaktors und ein rein
 * projektbezogen ergaenzter Faktor.
 *
 * Das Ueberschreibungsprotokoll wird NICHT von Hand geschrieben, sondern vom echten
 * Zwei-Ebenen-Merge erzeugt, und die Pipeline erhaelt die zusammengefuehrte Basis — so
 * prueft der Test die Herkunftsanzeige gegen die Pfadform des Kerns und nicht gegen
 * seine eigene Annahme darueber.
 */
function mitProjektDelta() {
  const firma = basis();
  const bestehenderFaktor = Object.keys(firma.aufwandfaktoren).sort((a, b) => a.localeCompare(b))[0]!;
  const neuerFaktor = 'projekt_laerm';
  const ergebnis = mergeKonfiguration(firma, {
    dossierDefaults: { stockwerk: 7 },
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

  it('weist eine uebersteuerte Dossier-Voreinstellung in Stufe 1 als projektbezogen aus', () => {
    const delta = mitProjektDelta();
    const stufen = bauePipelineDaten(delta.basis, { ueberschreibungen: delta.ueberschreibungen });
    const eingabe = stufen.find((s) => s.nr === 1)!;

    // `dossierDefaults.stockwerk` steht im Protokoll — die Zeile muss es zeigen.
    expect(zeile(eingabe, 'stockwerk').herkunft).toBe('projekt');
    // Gegenprobe: nicht uebersteuerte Felder bleiben firmenweit, die Anzeige faerbt
    // nicht pauschal ein, sobald irgendein Delta vorliegt.
    expect(zeile(eingabe, 'energielabel').herkunft).toBe('firmenweit');
  });

  it('weist die uebersteuerten Parameter der Stufen 2 und 5 als projektbezogen aus', () => {
    const delta = mitProjektDelta();
    const stufen = bauePipelineDaten(delta.basis, { ueberschreibungen: delta.ueberschreibungen });

    // Beide Zeilen waren bis zur Behebung von K-2 fest auf «firmenweit» verdrahtet.
    const verkauf = stufen.find((s) => s.nr === 2)!;
    expect(zeile(verkauf, 'Gewicht der Aussenfläche α').herkunft).toBe('projekt');
    expect(zeile(verkauf, 'Zulässige Zu-/Abschlagssumme je Einheit').herkunft).toBe('firmenweit');

    // Ein Protokolleintrag `honorar.skalierung.gMin` muss die Zeile treffen, die den
    // Skalierungsbereich zeigt — der Eintrag ist feiner als die Zeile.
    const honorar = stufen.find((s) => s.nr === 5)!;
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

    // Uebersteuert ist das GEWICHT: das faerbt die Beitragszeile, nicht die Skalenzeile,
    // deren angezeigte Grenzen unveraendert firmenweit gelten.
    expect(zeile(beitraege, bestehend).herkunft).toBe('projekt');
    expect(zeile(skalen, bestehend).herkunft).toBe('firmenweit');

    // Ein projektbezogen ergaenzter Faktor steht als ganzer Teilbaum im Protokoll
    // (`aufwandfaktoren.<faktor>`) — der Eintrag ist groeber als die Zeilen und muss
    // beide treffen.
    expect(zeile(skalen, neu).herkunft).toBe('projekt');
    expect(zeile(beitraege, neu).herkunft).toBe('projekt');
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

describe('istProjektbezogen', () => {
  function protokoll(...pfade: readonly string[]) {
    return pfade.map((pfad) => ({ pfad, defaultwert: null, projektwert: 1 }));
  }

  it('trifft einen Eintrag, der feiner oder groeber ist als der Bezugspfad der Zeile', () => {
    expect(istProjektbezogen(['honorar.skalierung.gMin'], protokoll('honorar.skalierung.gMin')))
      .toBe(true);
    // Groeber: der ganze Teilbaum wurde ersetzt.
    expect(istProjektbezogen(['honorar.skalierung.gMin'], protokoll('honorar'))).toBe(true);
    // Feiner: die Zeile zeigt den Teilbaum, uebersteuert wurde ein Blatt darin.
    expect(istProjektbezogen(['honorar.skalierung'], protokoll('honorar.skalierung.gMax')))
      .toBe(true);
    // Nachbarpfad derselben Wurzel darf nicht faelschlich treffen.
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
    // `api` steht in `GESPERRTE_PFADE`; der Merge lehnt eine solche Uebersteuerung ab.
    // Selbst wenn ein Eintrag den Pfad truege, darf die Anzeige ihn nicht bestaetigen.
    expect(istProjektbezogen(['api.baseUrl'], protokoll('api.baseUrl'))).toBe(false);
    expect(istProjektbezogen(['meta.konfigVersion'], protokoll('meta'))).toBe(false);
  });

  it('meldet ohne Protokoll nichts als projektbezogen', () => {
    expect(istProjektbezogen(['flaeche.alpha'], undefined)).toBe(false);
    expect(istProjektbezogen(['flaeche.alpha'], [])).toBe(false);
  });

  it('keine Zeile verdrahtet ihre Herkunft fest', () => {
    // Gegenprobe zur Ursache von K-2: In den Stufen 2 und 5 stand die Herkunft als
    // Literal im Quelltext und war damit vom Protokoll abgekoppelt. Faellt jemand
    // dorthin zurueck, faellt es hier auf, bevor der Rechenweg wieder falsch anzeigt.
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
    // Die Projektseite fuehrt KEINEN Weg in die Konfiguration ausser dem Verweis — sonst
    // bearbeitete der Vermarkter aus dem Projekt heraus Werte, die auf alle Projekte
    // wirken. Die Einstellungen-Uebersicht selbst bettet die Editoren inzwischen direkt
    // ein (`einstellungen/page.tsx`), statt ueber diese Komponente dorthin zu verlinken.
    expect(html).not.toContain('Bearbeiten');
  });
});
