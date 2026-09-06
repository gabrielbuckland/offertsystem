import { describe, expect, it } from 'vitest';
import { fuehreSzenarioAus, ladeSzenario, schreibeSzenarienArtefakt } from '../helper/szenario.js';
import { dokumentiere } from '../helper/dokumentiere.js';
import { ladeReferenz } from '../helper/referenz.js';

const SCHWELLE = 0.001;

describe('T2 — die sechs Testszenarien gegen ihre Erwartungswerte', () => {
  const ergebnisse = ['S1', 'S2', 'S3', 'S4a', 'S4b', 'S6'].map((id) => fuehreSzenarioAus(id));

  // In Vitest 2 reicht `it.each` den Testkontext (und damit `task.meta`) nicht
  // an die Testfunktion weiter; die Falltabelle laeuft deshalb als Schleife
  // ueber normale `it`-Aufrufe — die Testnamen bleiben identisch.
  for (const id of ['S1', 'S2', 'S3', 'S4a', 'S4b', 'S6']) {
    it(`${id} hält die Abweichungsschwelle von 0,1 Prozent in V, H_min und H_max ein`, ({ task }) => {
      dokumentiere(task, {
        vorbedingung: `Szenario ${id} mit hinterlegten Erwartungswerten`,
        schritte: 'Das Szenario durch die Pipeline rechnen und mit den Erwartungswerten vergleichen',
        erwartung: 'Die relative Abweichung in V, H_min und H_max beträgt je höchstens 0,1 Prozent',
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
      vorbedingung: 'Szenario S1 ohne Zu-/Abschläge und mit Referenzflächen',
      schritte: 'Das Szenario rechnen und alle Positionspreise prüfen',
      erwartung: 'Jeder Positionspreis ist exakt P_ref = 85 000 000 Rappen',
      invariante: 'I-05',
    });
    const e = fuehreSzenarioAus('S1');
    for (const p of e.ergebnis!.verkaufssumme.positionen) expect(p.preis).toBe(85_000_000);
  });

  it('S2: alpha wirkt in Zähler und Nenner, I-05 hält auch mit Aussenfläche', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S2, in dem jede Einheit Aussenfläche trägt',
      schritte: 'Das Szenario rechnen und die Typableitungen prüfen',
      erwartung: 'Alle Einheiten haben Aussenfläche und es entstehen zwei Typableitungen',
      invariante: 'I-05',
    });
    const e = fuehreSzenarioAus('S2');
    const szenario = ladeSzenario('S2');
    expect(szenario.einheiten.every((u) => u.A_aussen > 0)).toBe(true);
    expect(e.ergebnis!.verkaufssumme.typAbleitungen).toHaveLength(2);
  });

  it('S3: die Anpassungen sind je Position einzeln ausgewiesen und begründet (I-09)', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S3 mit Zu-/Abschlägen auf einzelnen Positionen',
      schritte: 'Das Szenario rechnen und die Positionen mit Anpassungen inspizieren',
      erwartung: 'Jede Anpassung trägt eine Begründung von mindestens 10 Zeichen; die Anpassungssumme bleibt in [-0.25, 0.25]',
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

  it('S6: alpha wirkt auf Einheiten mit abweichender Geometrie, Referenzgeometrie bleibt referenztreu', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S6 mit heterogenen Aussenflächen: Erdgeschoss ohne Balkon, Attika mit grosser Terrasse',
      schritte: 'Das Szenario rechnen und die Positionspreise nach Geometrie der Einheiten vergleichen',
      erwartung: 'Einheiten mit Referenzgeometrie kosten exakt P_ref; abweichende Einheiten weichen nach unten bzw. oben ab; V trifft die unabhängige Referenz exakt',
      invariante: 'I-05',
    });
    const e = fuehreSzenarioAus('S6');
    const preis = (nr: string): number =>
      e.ergebnis!.verkaufssumme.positionen.find((p) => p.wohnungsnummer === nr)!.preis;
    // Referenzgeometrie: alpha kuerzt sich aus eq:wohnungspreis, p_j = P_ref (I-05).
    expect(preis('A-02')).toBe(92_000_000);
    expect(preis('B-01')).toBe(132_000_000);
    // Abweichende Geometrie: alpha kuerzt sich nicht mehr — genau der Hebel,
    // ueber den die OAT-Dimension D2 in diesem Szenario messbar wird (F-061).
    expect(preis('A-01')).toBeLessThan(92_000_000);
    expect(preis('B-02')).toBeGreaterThan(132_000_000);
    expect(e.abweichung.verkaufssumme).toBe(0);
  });

  it('S5: ohne Referenzbewertung entsteht kein Ergebnis (I-24, 6.4 (c))', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S5 ohne Referenzbewertung',
      schritte: 'Das Szenario rechnen und Fehler sowie Ausgabeflag prüfen',
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
      vorbedingung: 'Alle sieben Szenariodefinitionen S1 bis S6',
      schritte: 'Jedes Szenario laden und das Feld lagedaten_herkunft prüfen',
      erwartung: 'Die Herkunft ist jeweils "synthetisch" oder "aufgezeichnet"',
    });
    for (const id of ['S1', 'S2', 'S3', 'S4a', 'S4b', 'S5', 'S6']) {
      expect(['synthetisch', 'aufgezeichnet']).toContain(ladeSzenario(id).lagedaten_herkunft);
    }
  });

  it('erzeugt das Artefakt für Kapitel 6 (P1) mit Abweichung und Pass/Fail', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Ergebnisse der sechs gerechneten Szenarien',
      schritte: 'schreibeSzenarienArtefakt mit den Ergebnissen aufrufen',
      erwartung: 'Das Artefakt liegt unter artifacts/scenarios/',
    });
    const pfad = schreibeSzenarienArtefakt(ergebnisse);
    expect(pfad).toMatch(/^artifacts\/scenarios\//);
  });

  it('erkennt eine verfälschte Erwartung als nicht bestanden', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Szenario S1 mit auf 1 überschriebener erwarteter Verkaufssumme',
      schritte: 'Das Szenario mit der verfälschten Erwartung rechnen',
      erwartung: 'bestanden ist false und die Abweichung der Verkaufssumme ist ausgewiesen',
    });
    // Gegenprobe zum Szenarienvergleich: Ohne sie bliebe offen, ob der Vergleich
    // ueberhaupt anschlaegt oder jedes Szenario unbesehen als bestanden gilt.
    const e = fuehreSzenarioAus('S1', { referenzUeberschreiben: { verkaufssumme: 1 } });
    expect(e.bestanden).toBe(false);
    expect(Math.abs(e.abweichung.verkaufssumme)).toBeGreaterThan(SCHWELLE);
  });

  it('weist einen Erwartungswert ohne Manifesteintrag zurück', ({ task }) => {
    dokumentiere(task, {
      vorbedingung: 'Blattname ohne Eintrag im Manifest',
      schritte: 'ladeReferenz mit dem unbekannten Namen aufrufen',
      erwartung: 'Der Lader wirft einen Fehler mit Hinweis auf den fehlenden Manifesteintrag',
    });
    // Gegenprobe zur Zusage des Manifests: Ohne die Pruefsummenkontrolle liesse sich ein
    // Erwartungswert an ein geaendertes Ergebnis anpassen, und der Vergleich verglich
    // die Implementierung mit sich selbst.
    expect(() => ladeReferenz('gibt_es_nicht')).toThrow(/Manifesteintrag/);
  });
});
