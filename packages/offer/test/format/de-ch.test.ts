/**
 * ABWEICHUNG VOM PLAN, bewusst und vom Plan selbst so vorgesehen: Die Erwartungswerte
 * folgen der tatsaechlichen ICU-Ausgabe der Laufzeit, nicht der im Plan notierten
 * Schreibweise. Konkret setzt `de-CH` als Tausendertrennung U+2019 (rechtes
 * Anfuehrungszeichen) statt des Apostrophs U+0027, ein festes Leerzeichen U+00A0 nach
 * dem Waehrungskuerzel, kein Leerzeichen vor dem
 * Prozentzeichen und ein gewoehnliches Minus. Der Plan haelt fest: «Bei abweichendem
 * Minuszeichen der Laufzeit wird der Erwartungswert des Tests an die Locale-Ausgabe
 * angepasst, nicht die Ausgabe an den Test» — eine eigene Ersetzung im String waere
 * genau der Weg, die Schweizer Notation an einer Stelle zu verlieren.
 */
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
} from '../../src/format/de-ch.js';

/** U+2019, die von `de-CH` verwendete Tausendertrennung. */
const T = '’';
/** U+00A0, das schmale feste Leerzeichen zwischen Waehrungskuerzel und Betrag. */
const NBSP = ' ';

describe('Betragsformatierung', () => {
  it('formatiert ein Aggregat ohne Nachkommastellen', () => {
    // 1 250 000.00 CHF liegen als 125 000 000 Rappen vor
    expect(formatiereAggregat(125_000_000)).toBe(`CHF${NBSP}1${T}250${T}000`);
  });

  it('formatiert einen Einzelpreis mit zwei Nachkommastellen', () => {
    expect(formatiereBetrag(84_512_345)).toBe(`CHF${NBSP}845${T}123.45`);
  });

  it('setzt Tausender- und Dezimaltrennung nicht selbst', () => {
    const quelle = readFileSync(new URL('../../src/format/de-ch.ts', import.meta.url), 'utf8');
    expect(quelle).not.toMatch(/\.replace\(/);
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
    // Die Grenze, die die Boundary-Regel nicht abdeckt: `Intl` ist eine Plattform-API
    // und wuerde von keinem Importverbot erfasst.
    const wurzel = fileURLToPath(new URL('../../../..', import.meta.url));
    const treffer = execSync("grep -rl 'Intl\\.' packages/core/src || true", {
      encoding: 'utf8', cwd: wurzel,
    }).trim();
    expect(treffer).toBe('');
  });
});
