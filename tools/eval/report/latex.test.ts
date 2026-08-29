import { describe, expect, it } from 'vitest';
import { latexEscape, zahlDeCh } from './latex.ts';

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
