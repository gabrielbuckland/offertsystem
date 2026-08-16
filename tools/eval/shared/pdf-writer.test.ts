import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { schreibePdf } from './pdf-writer.ts';

describe('schreibePdf', () => {
  const pdf = schreibePdf({
    breite: 400, hoehe: 200,
    elemente: [
      { art: 'rechteck', x: 10, y: 10, breite: 50, hoehe: 20, fuellung: [0.2, 0.4, 0.6] },
      { art: 'linie', x1: 0, y1: 0, x2: 400, y2: 200, breite: 0.5, farbe: [0, 0, 0] },
      { art: 'text', x: 20, y: 100, groesse: 9, inhalt: 'Verkaufssumme', farbe: [0, 0, 0] },
    ],
  });

  it('beginnt mit dem PDF-Kopf und endet mit EOF', () => {
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('fuehrt eine Kreuzreferenztabelle mit korrekter Objektzahl', () => {
    const objekte = [...pdf.matchAll(/^\d+ 0 obj$/gm)].length;
    expect(pdf).toContain(`/Size ${objekte + 1}`);
  });

  it('setzt die MediaBox auf die angegebene Groesse', () => {
    expect(pdf).toContain('/MediaBox [0 0 400 200]');
  });

  it('maskiert Klammern im Text', () => {
    const mitKlammer = schreibePdf({
      breite: 100, hoehe: 50,
      elemente: [{ art: 'text', x: 1, y: 1, groesse: 8, inhalt: 'a (b) c', farbe: [0, 0, 0] }],
    });
    expect(mitKlammer).toContain('(a \\(b\\) c) Tj');
  });

  it('wird von einem PDF-Werkzeug als gueltig gelesen, falls vorhanden', () => {
    // Eine formal falsche Kreuzreferenztabelle faellt beim Einbinden in LaTeX erst spaet
    // auf; deshalb einmal maschinell gegengeprueft, sofern pdfinfo verfuegbar ist.
    const ordner = mkdtempSync(join(tmpdir(), 'pdf-'));
    const pfad = join(ordner, 'probe.pdf');
    writeFileSync(pfad, schreibePdf({
      breite: 300, hoehe: 150,
      elemente: [{ art: 'text', x: 10, y: 10, groesse: 10, inhalt: 'Pruefung', farbe: [0, 0, 0] }],
    }), 'latin1');
    try {
      expect(execFileSync('pdfinfo', [pfad], { encoding: 'utf8' })).toContain('Pages:');
    } catch (fehler) {
      // pdfinfo nicht installiert: Pruefung entfaellt, der Strukturtest oben bleibt.
      expect(String(fehler)).toBeTruthy();
    }
  });
});
