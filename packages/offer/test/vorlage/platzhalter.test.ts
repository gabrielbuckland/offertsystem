import { describe, expect, it } from 'vitest';
import { formatiereAggregat, formatiereHonorarProzent } from '../../src/format/de-ch.js';
import { berechneHonorarProzent } from '../../src/model/honorar-eingabe.js';
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
    expect(werte.texte.erstelltAm).toMatch(/\d{4}/);
  });

  it('leitet den Honorar-Platzhalter als Prozentsatz der Verkaufssumme aus dem '
    + 'gewaehlten Betrag ab, nicht aus der Range und nicht in Franken', () => {
    const offerte = baueBeispielOfferte();
    offerte.aggregates.gewaehltesHonorar = { value: 6_722_733, provenance: 'marketer-decision' };
    const werte = platzhalterWerte(offerte);
    const anteil = berechneHonorarProzent(6_722_733, offerte.aggregates.totalSalesValue.value);
    expect(anteil).not.toBeNull();
    expect(werte.texte.honorar).toBe(formatiereHonorarProzent(anteil!));
    expect(werte.texte.honorar).not.toMatch(/^CHF/);
  });

  it('fuehrt den Honorarbetrag zusaetzlich in Franken (Nachtrag Spec 2026-08-29): der '
    + 'gerundete Prozentsatz allein liesse sich nicht verlustfrei auf den massgebenden '
    + 'Betrag zurueckrechnen', () => {
    const offerte = baueBeispielOfferte();
    offerte.aggregates.gewaehltesHonorar = { value: 6_722_733, provenance: 'marketer-decision' };
    const werte = platzhalterWerte(offerte);
    expect(werte.texte.honorarBetrag).toBe(formatiereAggregat(6_722_733));
  });

  it('zeigt einen Bindestrich statt eines Prozentsatzes, wenn die Verkaufssumme keine '
    + 'sinnvolle Bezugsgroesse ist (Division durch null) — der Frankenbetrag bleibt '
    + 'davon unberuehrt', () => {
    const offerte = baueBeispielOfferte();
    offerte.aggregates.gewaehltesHonorar = { value: 6_722_733, provenance: 'marketer-decision' };
    offerte.aggregates.totalSalesValue = { value: 0, provenance: 'local-derivation' };
    const werte = platzhalterWerte(offerte);
    expect(werte.texte.honorar).toBe('–');
    expect(werte.texte.honorarBetrag).toBe(formatiereAggregat(6_722_733));
  });

  it('laesst beide Honorar-Platzhalter weg, wenn die Offerte keinen gewaehlten Betrag '
    + 'fuehrt (Altartefakt)', () => {
    const werte = platzhalterWerte(baueBeispielOfferte());
    expect(werte.texte.honorar).toBeUndefined();
    expect(werte.texte.honorarBetrag).toBeUndefined();
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
    expect(ids).toContain('honorar');
    expect(ids).toContain('honorarBetrag');
    expect(new Set(ids).size).toBe(ids.length);
    PLATZHALTER_KATALOG.forEach((e) => expect(e.bezeichnung.length).toBeGreaterThan(0));
  });
});
