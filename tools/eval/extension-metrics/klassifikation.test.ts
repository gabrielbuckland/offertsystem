import { describe, expect, it } from 'vitest';
import { fasseZusammen, klassifiziere } from './klassifikation.ts';

describe('klassifiziere', () => {
  it('erkennt Quellcode in Paketen und Anwendungen', () => {
    expect(klassifiziere('packages/core/src/pipeline/normalisierung.ts').kategorie).toBe('code');
    expect(klassifiziere('apps/web/src/server/laden.ts').kategorie).toBe('code');
  });

  it('erkennt Konfiguration', () => {
    expect(klassifiziere('config/company-defaults.json').kategorie).toBe('konfiguration');
    expect(klassifiziere('vitest.config.json').kategorie).toBe('konfiguration');
  });

  it('erkennt Testdateien und Fixtures', () => {
    expect(klassifiziere('packages/core/test/property/i18.test.ts').kategorie).toBe('test');
    expect(klassifiziere('fixtures/pricehubble/synthetic/scores.json').kategorie).toBe('test');
  });

  it('ignoriert Werkzeuge, Artefakte und Doku', () => {
    for (const p of ['tools/eval/oat/main.ts', 'artifacts/eval/oat/x/oat.json',
                     'docs/testdoku/x.md']) {
      expect(klassifiziere(p).kategorie).toBe('sonstiges');
    }
  });

  it('meldet Testhilfen unter src als Verstoss gegen E-14', () => {
    const e = klassifiziere('packages/core/src/__fixtures__/projekt.ts');
    expect(e.kategorie).toBe('code');
    expect(e.befund).toContain('E-14');
  });
});

describe('fasseZusammen', () => {
  it('zaehlt geaenderte und neue Dateien sowie Zeilen je Kategorie', () => {
    const z = fasseZusammen([
      { pfad: 'packages/core/src/a.ts', hinzugefuegt: 10, entfernt: 0, neu: true },
      { pfad: 'packages/core/src/b.ts', hinzugefuegt: 3, entfernt: 2, neu: false },
      { pfad: 'config/company-defaults.json', hinzugefuegt: 8, entfernt: 4, neu: false },
      { pfad: 'docs/x.md', hinzugefuegt: 99, entfernt: 99, neu: false },
    ]);
    expect(z.code).toEqual({
      dateien_geaendert: 1, dateien_neu: 1, zeilen_hinzugefuegt: 13, zeilen_entfernt: 2,
      dateiliste: ['packages/core/src/a.ts', 'packages/core/src/b.ts'],
    });
    expect(z.konfiguration.dateien_geaendert).toBe(1);
    expect(z.sonstiges.dateien_geaendert).toBe(1);
  });
});
