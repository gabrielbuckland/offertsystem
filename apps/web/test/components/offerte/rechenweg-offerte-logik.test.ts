import { formatiereAggregat, formatiereFlaeche } from '@offert/offer';
import { describe, expect, it } from 'vitest';
import { baueOffertRechenweg } from '../../../src/components/offerte/rechenweg-offerte-logik.js';
import { baueBeispielOfferte } from '../../bau/offerte-bauer.js';

function alleZeilen(stufen: NonNullable<ReturnType<typeof baueOffertRechenweg>>['stufen']) {
  return stufen.flatMap((stufe) => stufe.abschnitte.flatMap((a) => a.zeilen ?? []));
}

describe('baueOffertRechenweg — eingefrorener Stand (US-12, NFA-07)', () => {
  it('baut die fuenf Stufen aus dem Artefakt und setzt die abgelegte Honorarrange ein', () => {
    const offerte = baueBeispielOfferte();
    const rechenweg = baueOffertRechenweg(offerte);
    expect(rechenweg).not.toBeNull();
    expect(rechenweg!.stufen.map((s) => s.nr)).toEqual([1, 2, 3, 4, 5]);
    const honorarMin = alleZeilen(rechenweg!.stufen)
      .find((zeile) => zeile.beschriftung === 'Honorar min');
    expect(honorarMin?.wert).toBe(formatiereAggregat(offerte.aggregates.feeRange.value.min));
  });

  it('zeigt in Stufe 1 nur die erfassten Felder je Wohnungstyp, keine Altfelder', () => {
    const rechenweg = baueOffertRechenweg(baueBeispielOfferte());
    const stufe1 = rechenweg!.stufen[0]!;
    expect(stufe1.abschnitte.map((a) => a.titel))
      .toEqual([undefined, 'Zustandsbewertungen', 'Qualitätsbewertungen']);
    expect(stufe1.abschnitte[0]!.tabelle!.zeilen).toEqual([
      ['3.5 Zimmer', formatiereFlaeche(82), '2027'],
      ['4.5 Zimmer', formatiereFlaeche(104), '2027'],
    ]);
    // Fest verdrahtete Altfelder des Schemas erscheinen nicht.
    const inhalt = JSON.stringify(stufe1);
    for (const altfeld of ['Energielabel', 'Heizungsart', 'Stockwerk', 'Lift', 'Aussenfläche']) {
      expect(inhalt).not.toContain(altfeld);
    }
  });

  it('traegt weder Editor-Links noch firmenweit/projekt-Kennzeichen', () => {
    const rechenweg = baueOffertRechenweg(baueBeispielOfferte());
    expect(rechenweg!.stufen.every((stufe) => stufe.editorPfad === undefined)).toBe(true);
    expect(alleZeilen(rechenweg!.stufen).every((zeile) => zeile.herkunft === undefined)).toBe(true);
  });

  it('weist ein uebersteuertes D aus dem serialisierten Eingang aus', () => {
    const offerte = baueBeispielOfferte();
    const rechenweg = baueOffertRechenweg({
      ...offerte,
      metadata: {
        ...offerte.metadata,
        berechnungsEingabe: {
          ...offerte.metadata.berechnungsEingabe,
          aufwandindikatorUebersteuerung: 0.5,
        },
      },
    });
    const zeile = alleZeilen(rechenweg!.stufen)
      .find((z) => z.ausdruck === 'vom Vermarkter übersteuert');
    expect(zeile?.beschriftung).toBe('Aufwandindikator D');
  });

  it('fuehrt die Berechnungsgrundlagen des Artefakts mit', () => {
    const offerte = baueBeispielOfferte();
    const rechenweg = baueOffertRechenweg(offerte);
    expect(rechenweg!.grundlagen.konfigVersion).toBe(offerte.metadata.konfigVersion);
    expect(rechenweg!.grundlagen.konfigPruefsumme).toBe(offerte.metadata.konfigPruefsumme);
    expect(rechenweg!.grundlagen.bewertungen.map((b) => b.typ))
      .toEqual(['3.5 Zimmer', '4.5 Zimmer']);
  });

  it('liefert null, wenn die Konfigurationskopie unlesbar ist', () => {
    const offerte = baueBeispielOfferte();
    expect(baueOffertRechenweg({
      ...offerte,
      metadata: { ...offerte.metadata, konfigurationsAbdruck: { kaputt: true } },
    })).toBeNull();
  });
});
