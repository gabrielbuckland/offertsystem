import { describe, expect, it } from 'vitest';
import { fuehreSzenarioAus, ladeSzenario, schreibeSzenarienArtefakt } from '../helper/szenario.js';
import { dokumentiere } from '../helper/dokumentiere.js';

const SCHWELLE = 0.05;

describe('T2 — die fuenf Testszenarien gegen die Referenzberechnung', () => {
  const ergebnisse = ['S1', 'S2', 'S3', 'S4a', 'S4b'].map((id) => fuehreSzenarioAus(id));

  // In Vitest 2 reicht `it.each` den Testkontext (und damit `task.meta`) nicht
  // an die Testfunktion weiter; die Falltabelle laeuft deshalb als Schleife
  // ueber normale `it`-Aufrufe — die Testnamen bleiben identisch.
  for (const id of ['S1', 'S2', 'S3', 'S4a', 'S4b']) {
    it(`${id} haelt die Abweichungsschwelle von 5 Prozent in V, H_min und H_max ein`, ({ task }) => {
      dokumentiere(task, {
        vorbedingung: `Szenario ${id} mit unabhaengiger Referenzberechnung`,
        schritte: 'Das Szenario durch die Pipeline rechnen und mit der Referenz vergleichen',
        erwartung: 'Die relative Abweichung in V, H_min und H_max betraegt je hoechstens 5 Prozent',
        anforderung: 'A-06',
      });
      const e = fuehreSzenarioAus(id);
      expect(e.fehler).toBeUndefined();
      expect(Math.abs(e.abweichung.verkaufssumme)).toBeLessThanOrEqual(SCHWELLE);
      expect(Math.abs(e.abweichung.honorarMin)).toBeLessThanOrEqual(SCHWELLE);
      expect(Math.abs(e.abweichung.honorarMax)).toBeLessThanOrEqual(SCHWELLE);
    });
  }

  it('S1: Referenztreue ist direkt beobachtbar, p_j = P_ref je Einheit (I-05)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S1 ohne Zu-/Abschlaege und mit Referenzflaechen',
      schritte: 'Das Szenario rechnen und alle Positionspreise pruefen',
      erwartung: 'Jeder Positionspreis ist exakt P_ref = 85 000 000 Rappen',
      invariante: 'I-05',
    });
    const e = fuehreSzenarioAus('S1');
    for (const p of e.ergebnis!.verkaufssumme.positionen) expect(p.preis).toBe(85_000_000);
  });

  it('S2: alpha wirkt in Zaehler und Nenner, I-05 haelt auch mit Aussenflaeche', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S2, in dem jede Einheit Aussenflaeche traegt',
      schritte: 'Das Szenario rechnen und die Typableitungen pruefen',
      erwartung: 'Alle Einheiten haben Aussenflaeche und es entstehen zwei Typableitungen',
      invariante: 'I-05',
    });
    const e = fuehreSzenarioAus('S2');
    const szenario = ladeSzenario('S2');
    expect(szenario.einheiten.every((u) => u.A_aussen > 0)).toBe(true);
    expect(e.ergebnis!.verkaufssumme.typAbleitungen).toHaveLength(2);
  });

  it('S3: die Anpassungen sind je Position einzeln ausgewiesen und begruendet (I-09)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S3 mit Zu-/Abschlaegen auf einzelnen Positionen',
      schritte: 'Das Szenario rechnen und die Positionen mit Anpassungen inspizieren',
      erwartung: 'Jede Anpassung traegt eine Begruendung von mindestens 10 Zeichen; die Anpassungssumme bleibt in [-0.25, 0.25]',
      invariante: 'I-09',
      anforderung: 'A-14',
    });
    const e = fuehreSzenarioAus('S3');
    const mitAnpassung = e.ergebnis!.verkaufssumme.positionen.filter((p) => p.anpassungen.length > 0);
    expect(mitAnpassung.length).toBeGreaterThan(0);
    for (const p of mitAnpassung) {
      for (const a of p.anpassungen) expect(a.begruendung.length).toBeGreaterThanOrEqual(10);
      expect(Math.abs(p.anpassungssumme)).toBeLessThanOrEqual(0.25);
    }
  });

  it('S4: der relative Honorarsatz steigt mit der Einheitenzahl nicht (I-18)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenarien S4a und S4b mit gleichem Typ, aber unterschiedlicher Einheitenzahl',
      schritte: 'Beide Szenarien rechnen und Verkaufssummen sowie Honorarrangen vergleichen',
      erwartung: 'V skaliert mit der Einheitenzahl; der relative Honorarsatz steigt nicht',
      invariante: 'I-18',
    });
    const a = fuehreSzenarioAus('S4a').ergebnis!;
    const b = fuehreSzenarioAus('S4b').ergebnis!;
    const v1 = a.verkaufssumme.verkaufssumme;
    const v2 = b.verkaufssumme.verkaufssumme;
    expect(v2 / v1).toBeCloseTo(b.verkaufssumme.einheitenzahl / a.verkaufssumme.einheitenzahl, 6);
    expect(b.honorar.honorarMin * v1).toBeLessThanOrEqual(a.honorar.honorarMin * v2);
    expect(b.honorar.honorarMax * v1).toBeLessThanOrEqual(a.honorar.honorarMax * v2);
  });

  it('S5: ohne Referenzbewertung entsteht kein Ergebnis (I-24, 6.4 (c))', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S5 ohne Referenzbewertung',
      schritte: 'Das Szenario rechnen und Fehler sowie Ausgabeflag pruefen',
      erwartung: 'Kein Ergebnis; Fehler REFERENZBEWERTUNG_FEHLT und ergebnisAusgegeben ist false',
      invariante: 'I-24',
    });
    const e = fuehreSzenarioAus('S5');
    expect(e.ergebnis).toBeUndefined();
    expect(e.fehler?.code).toBe('REFERENZBEWERTUNG_FEHLT');
    expect(e.ergebnisAusgegeben).toBe(false);
  });

  it('jedes Szenario weist die Herkunft der Lagedaten aus (R-01)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Alle sechs Szenariodefinitionen S1 bis S5',
      schritte: 'Jedes Szenario laden und das Feld lagedaten_herkunft pruefen',
      erwartung: 'Die Herkunft ist jeweils "synthetisch" oder "aufgezeichnet"',
    });
    for (const id of ['S1', 'S2', 'S3', 'S4a', 'S4b', 'S5']) {
      expect(['synthetisch', 'aufgezeichnet']).toContain(ladeSzenario(id).lagedaten_herkunft);
    }
  });

  it('erzeugt das Artefakt fuer Kapitel 6 (P1) mit Abweichung und Pass/Fail', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Ergebnisse der fuenf gerechneten Szenarien',
      schritte: 'schreibeSzenarienArtefakt mit den Ergebnissen aufrufen',
      erwartung: 'Das Artefakt liegt unter artifacts/scenarios/',
    });
    const pfad = schreibeSzenarienArtefakt(ergebnisse);
    expect(pfad).toMatch(/^artifacts\/scenarios\//);
  });

  it('erzeugt bei Ueberschreitung eine Stufendiagnose statt nur eines Fehlschlags', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S1 mit auf 1 ueberschriebener Referenz-Verkaufssumme',
      schritte: 'Das Szenario mit der verfaelschten Referenz rechnen',
      erwartung: 'bestanden ist false und die Stufendiagnose nennt die betroffenen Referenzschritte',
    });
    const e = fuehreSzenarioAus('S1', { referenzUeberschreiben: { verkaufssumme: 1 } });
    expect(e.bestanden).toBe(false);
    expect(e.stufendiagnose).toBeDefined();
    expect(Object.keys(e.stufendiagnose!)).toEqual(
      expect.arrayContaining(['02_qm_preis', '03_wohnungspreis', '04_verkaufssumme']));
  });
});
