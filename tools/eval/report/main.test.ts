import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoWurzel } from '../shared/artefakt.ts';
import { hauptlauf } from './main.ts';

describe('report/main — Abbruchbedingungen', () => {
  it('bricht ohne BA_MAIN mit einer klaren Meldung ab', () => {
    expect(() => hauptlauf({ main: null })).toThrow(/BA_MAIN/);
  });

  it('nennt fehlende Pflichtartefakte einzeln, statt still zu schweigen', () => {
    expect(() => hauptlauf({ main: '/tmp/main', wurzel: '/nicht/vorhanden' }))
      .toThrow(/eval\/oat/);
  });
});

describe('Abnahmetest G1 bis G3 (Spec 06 §8)', () => {
  it('erzeugt die Fragmente und die Tornado-Grafiken; jedes Fragment traegt den Hinweis', () => {
    const main = mkdtempSync(join(tmpdir(), 'main-'));
    // Ohne Beispiel-Offerte: `data/offerten/` ist nicht eingecheckt und entsteht erst im
    // Betrieb. Der Pruefpfad selbst ist in offerte.test.ts abgedeckt.
    // Die Abdeckungsdatei entsteht erst am Ende DIESES Laufs; sie wird deshalb hier
    // gestellt. Geprueft wird die Erzeugung der Fragmente, nicht die Abdeckungszahl.
    const coveragePfad = join(mkdtempSync(join(tmpdir(), 'cov-')), 'coverage-summary.json');
    writeFileSync(coveragePfad, JSON.stringify({
      total: { lines: { pct: 90 }, branches: { pct: 80 } },
    }), 'utf8');
    const geschrieben = hauptlauf({ main, ohneOfferte: true, coveragePfad });
    expect(geschrieben.some((p) => p.endsWith('a5-protokolle.tex'))).toBe(true);
    expect(geschrieben.some((p) => p.endsWith('p7-sensitivitaet.tex'))).toBe(true);
    expect(geschrieben.some((p) => p.endsWith('tornado-Hmax.pdf'))).toBe(true);
    for (const pfad of geschrieben.filter((p) => p.endsWith('.tex'))) {
      expect(readFileSync(pfad, 'utf8').startsWith('% AUTOMATISCH ERZEUGT'), pfad).toBe(true);
    }
  });
});

describe('Zeichensatz der Werkzeugtexte', () => {
  it('kein Werkzeugtext enthaelt ein Eszett oder fremde Schriftzeichen', () => {
    const dateien: string[] = [];
    const sammleTs = (ordner: string): void => {
      for (const eintrag of readdirSync(ordner)) {
        const pfad = join(ordner, eintrag);
        if (statSync(pfad).isDirectory()) sammleTs(pfad);
        else if (pfad.endsWith('.ts')) dateien.push(pfad);
      }
    };
    sammleTs(join(repoWurzel(), 'tools', 'eval'));
    for (const datei of dateien) {
      const inhalt = readFileSync(datei, 'utf8');
      // Die gesuchten Zeichen werden aus Codepunkten gebildet: Stuenden sie als Literal
      // in dieser Datei, faende die Pruefung sich selbst und waere immer rot.
      expect(inhalt.includes(String.fromCodePoint(0x00df)),
        `${datei} enthaelt ein Eszett`).toBe(false);
      const fremd = inhalt.match(new RegExp('[\\u0400-\\u04FF\\u0370-\\u03FF]', 'g'));
      expect(fremd, `${datei} enthaelt fremde Schriftzeichen: ${String(fremd)}`).toBeNull();
    }
  });
});
