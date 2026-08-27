/**
 * Quelltextnahe Absicherung der Verdrahtung, nach demselben Vorgehen wie
 * `packages/offer/test/format/de-ch.test.ts` («setzt Tausendertrennung nicht selbst»):
 * Das Repo fuehrt kein jsdom und keine Hook-Testbibliothek (`environment: 'node'`), die
 * Verdrahtung einer Komponente ist damit nicht ueber gerenderte Ereignisse pruefbar.
 *
 * Geprueft wird genau die Eigenschaft, die der Fehler verletzte: Die Neuberechnung darf
 * KEINEN eigenen Zeitgeber haben. Ein zweiter, aus derselben Zustandsaenderung gestarteter
 * Zeitgeber laeuft neben dem PUT statt hinter ihm — und `POST /berechnung` liest das
 * Projekt von der Platte. Eine bloss verlaengerte Entprellung verkleinerte das Fenster,
 * schloesse es aber nicht; deshalb prueft dieser Test auf Abwesenheit des Zeitgebers und
 * nicht auf eine Dauer.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quelle = readFileSync(
  new URL('../../../src/components/projekt/ProjektAnsicht.tsx', import.meta.url), 'utf8');

describe('ProjektAnsicht — Berechnung ist gekettet, nicht parallel', () => {
  it('startet keinen eigenen Zeitgeber fuer die Berechnung', () => {
    expect(quelle).not.toMatch(/setTimeout/);
  });

  it('stellt die Berechnung aus dem Erfolgspfad des Speicherns ein', () => {
    // `verwendeProjekt(anfang, rueckruf)` — der zweite Parameter ist der Erfolgspfad des
    // PUT (siehe `aufErfolg` in verwende-projekt.ts). Die Warteschlange selbst lebt seit
    // Task 8 in `verwende-berechnung.ts`; hier wird nur noch deren `stelleEin` verkettet
    // (I-1: neu unter einer Bedingung, siehe naechster Test).
    expect(quelle).toMatch(/verwendeProjekt\(\s*anfang,\s*\(gespeichert\) => \{/);
    expect(quelle).toMatch(/stelleEin\(gespeichert\);/);
  });

  it('reagiert nicht mehr auf den Projektstand als Effektabhaengigkeit', () => {
    // Ein `useEffect(..., [projekt])` waere der alte, parallele Ausloeser.
    expect(quelle).not.toMatch(/\}, \[projekt\]\)/);
  });

  it('ueberspringt die Berechnung, wenn sich nur rechenirrelevante Felder aendern (I-1)', () => {
    // `nurRechenirrelevanteFelderGeaendert` (projekt-rechenrelevanz.ts) ist die reine
    // Weiche dahinter — hier wird nur die Verdrahtung geprueft: der Aufruf sitzt im
    // Erfolgspfad des Speicherns, VOR dem `stelleEin`-Aufruf.
    expect(quelle).toMatch(/nurRechenirrelevanteFelderGeaendert\(/);
    const stelleEinIndex = quelle.indexOf('stelleEin(gespeichert);');
    const weicheIndex = quelle.indexOf('nurRechenirrelevanteFelderGeaendert(');
    expect(weicheIndex).toBeGreaterThan(-1);
    expect(weicheIndex).toBeLessThan(stelleEinIndex);
  });
});
