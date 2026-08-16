import { describe, expect, it } from 'vitest';
import type { Commit } from './git.ts';
import { fasseZusammen } from './klassifikation.ts';
import {
  KERNSTUFEN,
  SCOPE_REGELFALL,
  SCOPE_SONDERFALL,
  fuehreBoundaryPruefungAus,
  kernstufenBeruehrt,
  pruefeFaktormengeDatengetrieben,
  pruefeZuschnitt,
} from './kern.ts';

const commits: readonly Commit[] = [
  { hash: 'a1', betreff: 'Risikoindex konfigurieren', dateien: ['config/company-defaults.json'] },
  { hash: 'b2', betreff: 'Tippfehler in der Pipeline', dateien: ['packages/core/src/pipeline/stufe4.ts'] },
];

describe('pruefeZuschnitt', () => {
  it('laesst Commits innerhalb des Scopes durch', () => {
    const e = pruefeZuschnitt([commits[0]!], SCOPE_REGELFALL);
    expect(e.sauber).toBe(true);
    expect(e.stoerende).toHaveLength(0);
  });

  it('meldet stoerende Commits mit Hash, Betreff und Datei', () => {
    const e = pruefeZuschnitt(commits, SCOPE_REGELFALL);
    expect(e.sauber).toBe(false);
    expect(e.stoerende[0]!.hash).toBe('b2');
    expect(e.stoerende[0]!.dateien_ausserhalb)
      .toEqual(['packages/core/src/pipeline/stufe4.ts']);
  });

  it('erlaubt im Sonderfall genau die Normalisierungsschnittstelle', () => {
    const strategie: readonly Commit[] = [{
      hash: 'c3', betreff: 'Z-Score-Strategie',
      dateien: ['packages/core/src/normalization/zscore.ts'],
    }];
    expect(pruefeZuschnitt(strategie, SCOPE_SONDERFALL).sauber).toBe(true);
    expect(pruefeZuschnitt(strategie, SCOPE_REGELFALL).sauber).toBe(false);
  });
});

describe('kernstufenBeruehrt', () => {
  it('erkennt Aenderungen an den Kernstufen', () => {
    expect(kernstufenBeruehrt(['packages/core/src/pipeline/stufe3-normalisierung.ts']))
      .toEqual(['packages/core/src/pipeline/stufe3-normalisierung.ts']);
    expect(kernstufenBeruehrt(['config/company-defaults.json'])).toEqual([]);
    expect(KERNSTUFEN.length).toBeGreaterThanOrEqual(3);
  });
});

describe('fuehreBoundaryPruefungAus', () => {
  it('liefert Erfolg und Rohausgabe der ESLint-Boundary-Regel', () => {
    const e = fuehreBoundaryPruefungAus();
    expect(typeof e.erfolg).toBe('boolean');
    expect(typeof e.ausgabe).toBe('string');
  });
});

describe('pruefeFaktormengeDatengetrieben', () => {
  it('meldet eine literale Union von Faktorbezeichnern als Befund', () => {
    const mitUnion = pruefeFaktormengeDatengetrieben(
      ["export type FaktorId = 'lage_gesamt' | 'preissegment' | 'projektumfang';"]);
    expect(mitUnion.datengetrieben).toBe(false);
    expect(mitUnion.befunde[0]).toContain('FaktorId');

    const ohne = pruefeFaktormengeDatengetrieben(
      ['export type FaktorId = string & { readonly marke: unique symbol };']);
    expect(ohne.datengetrieben).toBe(true);
  });
});

describe('Abnahmetest F3 (Spec 06 §7.3)', () => {
  it('misst getrennt, entscheidet binaer, verweigert bei unsauberem Zuschnitt', () => {
    expect(pruefeZuschnitt(
      [{ hash: 'a', betreff: 'Konfiguration', dateien: ['config/company-defaults.json'] }],
      SCOPE_REGELFALL).sauber).toBe(true);
    expect(pruefeZuschnitt(
      [{ hash: 'b', betreff: 'Formatierung', dateien: ['packages/core/src/pipeline/a.ts'] }],
      SCOPE_REGELFALL).sauber).toBe(false);

    // Die Null-Dateien-Messlatte in ihrer geprueften Form: null geaenderte und null neue
    // CODEDATEIEN bei gleichzeitiger Aenderung genau einer Konfigurationsdatei.
    const zahlen = fasseZusammen([
      { pfad: 'config/company-defaults.json', hinzugefuegt: 9, entfernt: 4, neu: false },
    ]);
    expect(zahlen.code.dateien_geaendert).toBe(0);
    expect(zahlen.code.dateien_neu).toBe(0);
    expect(zahlen.konfiguration.dateien_geaendert).toBe(1);
  });
});
