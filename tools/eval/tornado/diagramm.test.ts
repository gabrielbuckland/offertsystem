import { describe, expect, it } from 'vitest';
import { baueBalken, zeichne, type OatZeile } from './diagramm.ts';

const zeilen: readonly OatZeile[] = [
  { dimension: 'D1', parameter_id: 'w:a', szenario_id: 'S1', delta_Hmax_prozent: 4, status: 'ok' },
  { dimension: 'D1', parameter_id: 'w:a', szenario_id: 'S2', delta_Hmax_prozent: 12, status: 'ok' },
  { dimension: 'D1', parameter_id: 'w:a', szenario_id: 'S1', delta_Hmax_prozent: -3, status: 'ok' },
  { dimension: 'D5', parameter_id: 'g', szenario_id: 'S1', delta_Hmax_prozent: -21, status: 'ok' },
  { dimension: 'D5', parameter_id: 'g', szenario_id: 'S1', delta_Hmax_prozent: null, status: 'unzulaessig' },
];

describe('baueBalken', () => {
  const balken = baueBalken(zeilen, 'delta_Hmax_prozent', 10);

  it('sortiert absteigend nach dem groessten Betrag', () => {
    expect(balken.map((b) => b.parameter_id)).toEqual(['g', 'w:a']);
  });

  it('nimmt je Vorzeichen den Betragsmaximalwert und fuehrt das Szenario mit', () => {
    const a = balken.find((b) => b.parameter_id === 'w:a')!;
    expect(a.positiv_prozent).toBe(12);
    expect(a.positiv_szenario).toBe('S2');
    expect(a.negativ_prozent).toBe(-3);
  });

  it('markiert Dominanz oberhalb der Schwelle', () => {
    expect(balken.find((b) => b.parameter_id === 'w:a')!.dominant).toBe(true);
    expect(balken.find((b) => b.parameter_id === 'g')!.dominant).toBe(true);
  });

  it('laesst nicht auswertbare Zeilen aus', () => {
    expect(balken.every((b) => b.negativ_prozent !== null || b.positiv_prozent !== null))
      .toBe(true);
  });
});

describe('zeichne', () => {
  it('zeichnet je Balken zwei Rechtecke, eine Nulllinie und zwei Schwellenlinien', () => {
    const seite = zeichne(baueBalken(zeilen, 'delta_Hmax_prozent', 10), {
      schwelle: 10,
    });
    expect(seite.elemente.filter((e) => e.art === 'rechteck')).toHaveLength(4);
    expect(seite.elemente.filter((e) => e.art === 'linie').length).toBeGreaterThanOrEqual(3);
    expect(seite.elemente.some((e) => e.art === 'text' && e.inhalt.includes('relative Änderung'))).toBe(true);
  });
});
