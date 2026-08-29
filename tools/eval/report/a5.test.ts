import { describe, expect, it } from 'vitest';
import {
  a5Coverage,
  a5Fehlerprotokoll,
  a5Protokolle,
  a5Testfaelle,
  type CoverageArtefakt,
  type TestArtefakt,
} from './a5.ts';

const tests: TestArtefakt = {
  kopf: { zeitstempel: '2026-08-16T10-00-00Z', git_commit: 'abc123', node_version: 'v22.6.0' },
  seed: 424242,
  faelle: [
    { datei: 'packages/core/test/unit/stufe5.test.ts', suite: 'Stufe 5', name: 'interpoliert',
      zustand: 'pass', dauer_ms: 5, vorbedingung: 'Standardkonfiguration', schritte: 'aufrufen',
      erwartung: 'Referenzwert', invariante: 'I-20', anforderung: 'A-04', fehlermeldung: null },
    { datei: 'packages/core/test/unit/y.test.ts', suite: null, name: 'teilweise dokumentiert',
      zustand: 'pass', dauer_ms: 2, vorbedingung: 'nur Vorbedingung', schritte: null,
      erwartung: null, invariante: null, anforderung: null, fehlermeldung: null },
    { datei: 'packages/core/test/unit/x.test.ts', suite: null, name: 'ohne Metadaten',
      zustand: 'pass', dauer_ms: 1, vorbedingung: null, schritte: null,
      erwartung: null, invariante: null, anforderung: null, fehlermeldung: null },
  ],
};

describe('a5Testfaelle', () => {
  const tex = a5Testfaelle(tests);

  it('fuehrt Vorbedingung, Schritte und Erwartungswert je Testfall', () => {
    expect(tex).toContain('Standardkonfiguration');
    expect(tex).toContain('Referenzwert');
    expect(tex).toContain('A-04');
  });

  it('macht fehlende Metadaten teilweise dokumentierter Faelle sichtbar', () => {
    expect(tex).toContain('nur Vorbedingung');
    expect(tex).toContain('METADATEN FEHLEN');
  });

  it('laesst undokumentierte Faelle weg und weist die Auswahl in der Beschriftung aus', () => {
    expect(tex).not.toContain('ohne Metadaten');
    expect(tex).toContain('2 dokumentierte von 3');
  });

  it('bricht ab, wenn kein Fall Metadaten traegt', () => {
    const ohne = {
      ...tests,
      faelle: tests.faelle.map((f) => ({
        ...f, vorbedingung: null, schritte: null, erwartung: null,
      })),
    };
    expect(() => a5Testfaelle(ohne)).toThrow(/Metadaten/u);
  });

  it('traegt den Hinweis auf die automatische Erzeugung', () => {
    expect(tex.startsWith('% AUTOMATISCH ERZEUGT')).toBe(true);
  });
});

describe('a5Protokolle', () => {
  it('fuehrt Datum, Ergebnis, Kommentar und den Seed im Protokollkopf', () => {
    const tex = a5Protokolle(tests);
    expect(tex).toContain('424242');
    expect(tex).toContain('2026-08-16');
    expect(tex).toContain('abc123');
  });

  it('bricht ab, wenn der Seed fehlt', () => {
    expect(() => a5Protokolle({ ...tests, seed: null })).toThrow(/seed/i);
  });
});

describe('a5Coverage', () => {
  const coverage: CoverageArtefakt = {
    total: { lines: { pct: 96.4 }, branches: { pct: 91.2 } },
    'packages/core/src/pipeline/stufe4.ts':
      { lines: { pct: 100, covered: 100, total: 100 },
        branches: { pct: 95, covered: 19, total: 20 } },
    'packages/core/src/pipeline/stufe5.ts':
      { lines: { pct: 50, covered: 150, total: 300 },
        branches: { pct: 50, covered: 10, total: 20 } },
    'packages/pricehubble/src/client/http.ts':
      { lines: { pct: 82.1, covered: 821, total: 1000 },
        branches: { pct: 70, covered: 70, total: 100 } },
  };

  it('weist die Abdeckung je Paket mit den Zielwerten und deren Herkunft aus', () => {
    const tex = a5Coverage(coverage);
    expect(tex).toContain('96.40');
    expect(tex).toContain('@offert/core');
    expect(tex).toContain('eigene Festlegung');
  });

  it('aggregiert zeilengewichtet statt als Mittel der Datei-Prozentsaetze', () => {
    const tex = a5Coverage(coverage);
    // core: (100+150)/(100+300) = 62.50 % — das Dateimittel waere 75.00 %.
    expect(tex).toContain('62.50');
    expect(tex).not.toContain('75.00');
  });

  it('bricht bei einem Eintrag ohne covered/total ab, statt still zu mitteln', () => {
    const alt: CoverageArtefakt = {
      'packages/core/src/x.ts': { lines: { pct: 90 }, branches: { pct: 80 } },
    };
    expect(() => a5Coverage(alt)).toThrow(/covered\/total/u);
  });
});

describe('a5Fehlerprotokoll', () => {
  it('fuehrt fehlgeschlagene Laeufe mit Gegenbeispiel und Seed', () => {
    const tex = a5Fehlerprotokoll(
      { ...tests, faelle: [{ ...tests.faelle[0]!, zustand: 'fail',
                             fehlermeldung: 'erwartet 1, war 2' }] },
      { seed: 424242, properties: [{ id: 'I-18', pass: false, gegenbeispiel: '{ m1: 4, m2: 36 }' }] },
    );
    expect(tex).toContain('erwartet 1, war 2');
    expect(tex).toContain('I-18');
    expect(tex).toContain('424242');
  });

  it('sagt ausdruecklich, wenn nichts fehlgeschlagen ist', () => {
    expect(a5Fehlerprotokoll(tests, null)).toContain('kein Testfall fehlgeschlagen');
  });
});
