import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baueOfferte, type OfferteEingang } from '../../src/model/baue-offerte.js';
import {
  BEISPIEL_PROJEKT,
  BEISPIEL_META,
  baueBerechnungsErgebnis,
  baueLiegenschaft,
} from '../bau/berechnung-bauer.js';

function eingang(optionen: { anpassungMitVorlage?: string | undefined } = {}): OfferteEingang {
  return {
    ergebnis: baueBerechnungsErgebnis(optionen),
    liegenschaft: baueLiegenschaft(optionen),
    projekt: BEISPIEL_PROJEKT,
    meta: BEISPIEL_META,
  };
}

describe('baueOfferte — Rechenwerte stammen ausschliesslich aus dem Ergebnis (E-19)', () => {
  it('uebernimmt Verkaufssumme und Honorarrange unveraendert aus dem Ergebnis', () => {
    const e = eingang();
    const offerte = baueOfferte(e);
    expect(offerte.aggregates.totalSalesValue.value)
      .toBe(e.ergebnis.verkaufssumme.verkaufssumme);
    expect(offerte.aggregates.feeRange.value.min).toBe(e.ergebnis.honorar.honorarMin);
    expect(offerte.aggregates.feeRange.value.max).toBe(e.ergebnis.honorar.honorarMax);
  });

  it('uebernimmt die Stufenangabe aufgeloest aus dem Ergebnis', () => {
    const e = eingang();
    const t = baueOfferte(e).aggregates.feeTier.value;
    expect(t).toEqual({
      k: e.ergebnis.honorar.stufenindex,
      ...e.ergebnis.honorar.stufe,
      interpolationsAnteil: e.ergebnis.honorar.interpolationsanteil,
    });
  });

  it('durchsucht die Stuetzstellenliste nicht selbst', () => {
    const quelle = readFileSync(
      new URL('../../src/model/baue-offerte.ts', import.meta.url), 'utf8',
    );
    expect(quelle).not.toContain('stuetzstellen');
  });
});

describe('baueOfferte — Herkunftszuordnung', () => {
  it('weist die Referenzbewertung als PriceHubble-Herkunft aus', () => {
    const o = baueOfferte(eingang());
    expect(o.derivation.apartmentTypes[0]!.referenceValuation.provenance).toBe('pricehubble');
    expect(o.derivation.apartmentTypes[0]!.pricePerSqm.provenance).toBe('local-derivation');
    expect(o.derivation.units[0]!.adjustments[0]!.provenance).toBe('marketer-adjustment');
    expect(o.aggregates.feeRange.provenance).toBe('local-calculation');
  });
});

describe('baueOfferte — Vorlagenherkunft (PE-07, A-13)', () => {
  it('reicht vorlageId einer uebernommenen Anpassung unveraendert durch', () => {
    const o = baueOfferte(eingang({ anpassungMitVorlage: 'seesicht' }));
    expect(o.derivation.units[0]!.adjustments[0]!.value.vorlageId).toBe('seesicht');
  });

  it('laesst vorlageId bei einer frei erfassten Anpassung weg, statt sie zu erfinden', () => {
    const o = baueOfferte(eingang({ anpassungMitVorlage: undefined }));
    expect(o.derivation.units[0]!.adjustments[0]!.value).not.toHaveProperty('vorlageId');
  });
});

describe('baueOfferte — Metadaten (E-26)', () => {
  it('bettet die Konfiguration als Kopie ein', () => {
    const e = eingang();
    const o = baueOfferte(e);
    const abdruck = JSON.parse(JSON.stringify(o.metadata.konfigurationsAbdruck)) as {
      flaeche: { alpha: number };
    };
    expect(abdruck.flaeche.alpha).toBe(e.ergebnis.konfigurationsAbdruck.flaeche.alpha);
    expect(JSON.stringify(o.metadata)).not.toContain('company-defaults.json');
  });
});
