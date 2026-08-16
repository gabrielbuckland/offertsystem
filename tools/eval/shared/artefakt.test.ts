import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alsCsv, bildeKopf, leseLatest, schreibeArtefakt } from './artefakt.ts';

describe('bildeKopf', () => {
  it('fuehrt alle acht Pflichtfelder', () => {
    const kopf = bildeKopf('oat', 'config/company-defaults.json', 1);
    for (const feld of [
      'instrument', 'zeitstempel', 'git_commit', 'git_dirty',
      'node_version', 'konfig_datei', 'konfig_sha256', 'werkzeug_version',
    ]) {
      expect(kopf).toHaveProperty(feld);
    }
    expect(kopf.zeitstempel).not.toContain(':');
  });
});

describe('schreibeArtefakt', () => {
  it('schreibt Dateien und einen latest-Zeiger', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'eval-'));
    const kopf = bildeKopf('oat', 'config/company-defaults.json', 1);
    const verzeichnis = schreibeArtefakt(wurzel, kopf, {
      'oat.json': JSON.stringify({ kopf, zeilen: [] }),
      'oat.csv': 'a,b\n1,2\n',
    });
    expect(existsSync(join(verzeichnis, 'oat.json'))).toBe(true);
    expect(existsSync(join(verzeichnis, 'oat.csv'))).toBe(true);
    const zeiger = JSON.parse(
      readFileSync(join(wurzel, 'artifacts', 'eval', 'oat', 'latest.json'), 'utf8'),
    ) as { verzeichnis: string };
    expect(zeiger.verzeichnis).toBe(verzeichnis);
    expect(leseLatest(wurzel, 'eval/oat')).toBe(verzeichnis);
  });

  it('liest auch Ablagen ausserhalb von eval, die andere Plaene schreiben', () => {
    // Haelt die Abhaengigkeit fest, die PE-18 begruendet: artifacts/contract/ stammt aus
    // P3, nicht aus diesem Plan, wird aber ueber denselben Zeiger gelesen.
    const wurzel = mkdtempSync(join(tmpdir(), 'eval-'));
    const ziel = join(wurzel, 'artifacts', 'contract', '2026-08-16T10-00-00Z');
    mkdirSync(ziel, { recursive: true });
    writeFileSync(
      join(wurzel, 'artifacts', 'contract', 'latest.json'),
      JSON.stringify({ verzeichnis: ziel, zeitstempel: '2026-08-16T10-00-00Z' }),
      'utf8',
    );
    expect(leseLatest(wurzel, 'contract')).toBe(ziel);
  });
});

describe('Kodierung je Dateiendung', () => {
  it('schreibt PDF-Dateien in latin1, damit die Byteversaetze stimmen', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'eval-'));
    const kopf = bildeKopf('probe', 'config/company-defaults.json', 1);
    const inhalt = '%PDF-1.4\nBruecke mit Umlaut: \u00fc\n%%EOF\n';
    const verzeichnis = schreibeArtefakt(wurzel, kopf, { 'a.pdf': inhalt });
    expect(readFileSync(join(verzeichnis, 'a.pdf')).length).toBe(inhalt.length);
  });
});

describe('alsCsv', () => {
  it('maskiert Trennzeichen und Anfuehrungszeichen', () => {
    const csv = alsCsv(['a', 'b'], [{ a: 'x;y', b: 'er sagte "ja"' }]);
    expect(csv).toBe('a;b\n"x;y";"er sagte ""ja"""\n');
  });
});
