import { describe, expect, it } from 'vitest';
import { PLATZHALTER_KATALOG, platzhalterWerte } from '../../src/vorlage/platzhalter.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

describe('platzhalterWerte', () => {
  it('leitet alle Textwerte formatiert aus der Offerte ab', () => {
    const offerte = baueBeispielOfferte();
    const werte = platzhalterWerte(offerte, { auftraggeber: 'Muster Immobilien AG' });
    const adresse = offerte.property.adresse;
    expect(werte.texte.adresse)
      .toBe(`${adresse.strasse} ${adresse.hausnummer}, ${adresse.plz} ${adresse.ort}`);
    expect(werte.texte.ort).toBe(adresse.ort);
    expect(werte.texte.auftraggeber).toBe('Muster Immobilien AG');
    expect(werte.texte.anzahlEinheiten).toBe(String(offerte.derivation.units.length));
    expect(werte.texte.anzahlWohnungstypen)
      .toBe(String(offerte.derivation.apartmentTypes.length));
    // Formatiert wie überall: CHF-Aggregat mit fester Tausendertrennung (NFA-13).
    expect(werte.texte.verkaufssumme).toMatch(/^CHF/);
    expect(werte.texte.honorarMin).toMatch(/^CHF/);
    expect(werte.texte.honorarMax).toMatch(/^CHF/);
    expect(werte.texte.erstelltAm).toMatch(/\d{4}/);
  });

  it('lässt auftraggeber weg, wenn der Kontext keinen liefert', () => {
    const werte = platzhalterWerte(baueBeispielOfferte());
    expect(werte.texte.auftraggeber).toBeUndefined();
  });

  it('baut die Preistabelle je Einheit mit formatierter Fläche und Preis', () => {
    const offerte = baueBeispielOfferte();
    const werte = platzhalterWerte(offerte);
    expect(werte.preistabelle).toHaveLength(offerte.derivation.units.length);
    expect(werte.preistabelle[0]!.einheit)
      .toBe(offerte.derivation.units[0]!.unitNumber);
    expect(werte.preistabelle[0]!.flaeche).toContain('m²');
    expect(werte.preistabelle[0]!.preis).toMatch(/^CHF/);
  });
});

describe('PLATZHALTER_KATALOG', () => {
  it('führt alle Textplatzhalter und die Preistabelle mit Bezeichnung', () => {
    const ids = PLATZHALTER_KATALOG.map((e) => e.id);
    expect(ids).toContain('verkaufssumme');
    expect(ids).toContain('preistabelle');
    expect(new Set(ids).size).toBe(ids.length);
    PLATZHALTER_KATALOG.forEach((e) => expect(e.bezeichnung.length).toBeGreaterThan(0));
  });
});
