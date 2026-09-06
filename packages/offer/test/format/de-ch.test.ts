// Erwartungswerte folgen der echten ICU-Ausgabe (de-CH: U+2019 statt Apostroph,
// U+00A0 nach Waehrungskuerzel). Bei Laufzeit-Abweichung den Testwert anpassen,
// nie die Ausgabe per Ersetzung "korrigieren".
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  formatiereAggregat,
  formatiereBetrag,
  formatiereDatum,
  formatiereFlaeche,
  formatiereProzent,
  formatiereScore,
  formatiereZimmerzahl,
  mitFesterTrennung,
} from '../../src/format/de-ch.js';

const T = '’'; // U+2019, Tausendertrennung von de-CH
const NBSP = ' '; // U+00A0

describe('Betragsformatierung', () => {
  it('formatiert ein Aggregat ohne Nachkommastellen', () => {
    // 1 250 000.00 CHF liegen als 125 000 000 Rappen vor
    expect(formatiereAggregat(125_000_000)).toBe(`CHF${NBSP}1${T}250${T}000`);
  });

  it('formatiert einen Einzelpreis mit zwei Nachkommastellen', () => {
    expect(formatiereBetrag(84_512_345)).toBe(`CHF${NBSP}845${T}123.45`);
  });

  it('macht keine Ersetzung im fertigen String', () => {
    const quelle = readFileSync(new URL('../../src/format/de-ch.ts', import.meta.url), 'utf8');
    expect(quelle).not.toMatch(/\.replace\(/);
  });
});

// Node und Chromium liefern fuer de-CH unterschiedliche Tausenderzeichen (U+2019 vs.
// ASCII-Apostroph); ungebunden gaebe das Hydratationsabweichungen (NFA-13). Test reicht
// die fremde Trennung direkt als Intl.NumberFormatPart[] herein, ohne zweite Laufzeit.
describe('Tausendertrennung ist laufzeitunabhaengig festgelegt', () => {
  it('ersetzt eine abweichende Trennung der Laufzeit durch die feste', () => {
    const teileWieChromium: Intl.NumberFormatPart[] = [
      { type: 'currency', value: 'CHF' },
      { type: 'literal', value: NBSP },
      { type: 'integer', value: '1' },
      { type: 'group', value: "'" },
      { type: 'integer', value: '250' },
      { type: 'group', value: "'" },
      { type: 'integer', value: '000' },
    ];
    expect(mitFesterTrennung(teileWieChromium)).toBe(`CHF${NBSP}1${T}250${T}000`);
  });

  it('laesst alle uebrigen Teile unveraendert, auch Dezimaltrennung und Vorzeichen', () => {
    const teile: Intl.NumberFormatPart[] = [
      { type: 'minusSign', value: '-' },
      { type: 'integer', value: '845' },
      { type: 'group', value: "'" },
      { type: 'integer', value: '123' },
      { type: 'decimal', value: '.' },
      { type: 'fraction', value: '45' },
    ];
    expect(mitFesterTrennung(teile)).toBe(`-845${T}123.45`);
  });

  it('gibt fuer jeden Formatierer dieselbe Trennung aus, nie den ASCII-Apostroph', () => {
    for (const text of [
      formatiereAggregat(125_000_000),
      formatiereBetrag(84_512_345),
      formatiereFlaeche(12_345.6),
      formatiereScore(12_345),
      formatiereZimmerzahl(1_234.5),
    ]) {
      expect(text).toContain(T);
      expect(text).not.toContain("'");
    }
  });
});

describe('Uebrige Formatierer', () => {
  it('formatiert Flaechen mit einer Nachkommastelle und Einheit', () => {
    expect(formatiereFlaeche(84.52)).toBe('84.5 m²');
  });

  it('formatiert Zu-/Abschlaege mit Vorzeichen', () => {
    expect(formatiereProzent(0.035)).toBe('+3.5%');
    expect(formatiereProzent(-0.02)).toBe('-2.0%');
  });

  it('formatiert die Zimmerzahl in Schweizer Dezimalnotation', () => {
    expect(formatiereZimmerzahl(3.5)).toBe('3.5');
  });

  it('formatiert Scores, D, g(D) und Gewichte mit drei Nachkommastellen', () => {
    expect(formatiereScore(0.6423)).toBe('0.642');
  });

  it('formatiert ein Datum in Schweizer Schreibweise', () => {
    expect(formatiereDatum('2026-08-16')).toBe('16.08.2026');
  });
});

describe('Grenzen der Formatierungsschicht', () => {
  it('bietet keine Umkehrfunktion von Anzeigetext zu Zahl', async () => {
    const modul = await import('../../src/format/de-ch.js');
    expect(Object.keys(modul).filter((n) => /parse|lies|zurueck/i.test(n))).toEqual([]);
    for (const fn of Object.values(modul)) {
      expect(typeof fn === 'function').toBe(true);
    }
  });

  it('haelt Intl aus packages/core heraus', () => {
    // Intl ist Plattform-API, kein Import — vom Importverbot nicht erfasst.
    const wurzel = fileURLToPath(new URL('../../../..', import.meta.url));
    const treffer = execSync("grep -rl 'Intl\\.' packages/core/src || true", {
      encoding: 'utf8', cwd: wurzel,
    }).trim();
    expect(treffer).toBe('');
  });
});
