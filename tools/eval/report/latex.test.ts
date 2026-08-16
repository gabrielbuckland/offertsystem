import { describe, expect, it } from 'vitest';
import { frankenAusRappen, latexEscape, longtable, zahlDeCh } from './latex.ts';

describe('latexEscape', () => {
  it('maskiert die Sonderzeichen von LaTeX', () => {
    expect(latexEscape('a_b & c % d # e $ f { g } h ~ i ^ j \\ k'))
      .toBe('a\\_b \\& c \\% d \\# e \\$ f \\{ g \\} h \\textasciitilde{} i '
        + '\\textasciicircum{} j \\textbackslash{} k');
  });
});

describe('zahlDeCh', () => {
  it('setzt den Hochkomma-Tausendertrenner der Schweizer Notation', () => {
    expect(zahlDeCh(1234567.5, 2)).toBe("1'234'567.50");
    expect(zahlDeCh(-42, 0)).toBe('-42');
  });
});

describe('frankenAusRappen', () => {
  it('rechnet erst bei der Darstellung in Franken um', () => {
    expect(frankenAusRappen(42_000_000)).toBe("420'000.00");
  });
});

describe('longtable', () => {
  it('erzeugt Kopf, Zeilen und Beschriftung', () => {
    const t = longtable({
      spalten: ['l', 'r'], kopf: ['ID', 'Wert'],
      zeilen: [['A-04', "1'000"]],
      beschriftung: 'Probe', label: 'tab:probe',
    });
    expect(t).toContain('\\begin{longtable}{lr}');
    expect(t).toContain('\\textbf{ID} & \\textbf{Wert}');
    expect(t).toContain("A-04 & 1'000");
    expect(t).toContain('\\label{tab:probe}');
    expect(t).toContain('\\end{longtable}');
  });
});
