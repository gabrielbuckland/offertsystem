import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoWurzel } from '../shared/artefakt.ts';
import {
  faelleAus, pruefeAnforderungsIds, traegtDokumentierteFaelle, type Testfall,
} from './vitest-reporter.ts';

interface Anforderung { id: string; prioritaet: string; wortlaut: string }

const liste = JSON.parse(readFileSync(
  join(repoWurzel(), 'tools', 'eval', 'report', 'anforderungen.json'), 'utf8'),
) as readonly Anforderung[];

describe('anforderungen.json', () => {
  it('fuehrt genau A-01 bis A-14', () => {
    expect(liste.map((a) => a.id)).toEqual(
      Array.from({ length: 14 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`));
  });

  it('haelt die mit E-23 korrigierte Zuordnung fest', () => {
    const wortlaut = (id: string): string => liste.find((a) => a.id === id)!.wortlaut;
    expect(wortlaut('A-04')).toContain('Honorarrange');
    expect(wortlaut('A-05')).toContain('Offerte');
    expect(wortlaut('A-06')).toContain('Testabdeckung');
    expect(wortlaut('A-07')).toContain('Konfigurierbarkeit');
    expect(wortlaut('A-11')).toContain('PDF');
  });

  it('fuehrt die vier Should korrekt (A-12 vor der Umsetzung von Could angehoben)', () => {
    const prio = (id: string): string => liste.find((a) => a.id === id)!.prioritaet;
    expect([prio('A-08'), prio('A-09'), prio('A-10'), prio('A-12')])
      .toEqual(['Should', 'Should', 'Should', 'Should']);
  });
});

describe('faelleAus', () => {
  const dateien = [{
    filepath: '/repo/packages/core/test/unit/stufe5.test.ts',
    tasks: [{
      type: 'suite', name: 'Stufe 5',
      tasks: [{
        type: 'test', name: 'interpoliert linear', mode: 'run',
        result: { state: 'pass', duration: 12 },
        meta: {
          vorbedingung: 'Standardkonfiguration geladen',
          schritte: 'bildeHonorarrange mit V in Stufenmitte aufrufen',
          erwartung: 'H_min und H_max entsprechen der Referenz-CSV',
          invariante: 'I-20', anforderung: 'A-04',
        },
      }],
    }],
  }];

  it('flacht Suiten ab und uebernimmt die Metadaten', () => {
    const f = faelleAus(dateien, '/repo');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      datei: 'packages/core/test/unit/stufe5.test.ts',
      suite: 'Stufe 5', name: 'interpoliert linear',
      zustand: 'pass', invariante: 'I-20', anforderung: 'A-04',
    });
  });

  it('setzt fehlende Metadaten auf null statt sie zu erfinden', () => {
    const ohne = [{
      filepath: '/repo/a.test.ts',
      tasks: [{ type: 'test', name: 'x', mode: 'run', result: { state: 'pass', duration: 1 } }],
    }];
    expect(faelleAus(ohne, '/repo')[0]!.vorbedingung).toBeNull();
  });
});

describe('pruefeAnforderungsIds', () => {
  const fall = (anforderung: string | null): Testfall => ({
    datei: 'a', suite: null, name: 'x', zustand: 'pass', dauer_ms: null,
    vorbedingung: null, schritte: null, erwartung: null, invariante: null,
    anforderung, fehlermeldung: null,
  });

  it('meldet unbekannte Anforderungs-IDs', () => {
    expect(pruefeAnforderungsIds([fall('A-99')])).toEqual(['A-99']);
    expect(pruefeAnforderungsIds([fall('A-04')])).toEqual([]);
  });
});

describe('traegtDokumentierteFaelle', () => {
  const fall = (meta: Partial<Testfall>): Testfall => ({
    datei: 'a', suite: null, name: 'x', zustand: 'pass', dauer_ms: null,
    vorbedingung: null, schritte: null, erwartung: null, invariante: null,
    anforderung: null, fehlermeldung: null, ...meta,
  });

  it('erkennt einen Lauf mit annotierter Kernalgorithmik', () => {
    expect(traegtDokumentierteFaelle([fall({}), fall({ schritte: 's' })])).toBe(true);
  });

  it('verneint einen Teil-Lauf ohne dokumentierte Faelle (F-077)', () => {
    expect(traegtDokumentierteFaelle([fall({}), fall({ invariante: 'I-01' })])).toBe(false);
    expect(traegtDokumentierteFaelle([])).toBe(false);
  });
});
