import { describe, expect, it } from 'vitest';
import { abrufWarnungstext } from '../../../src/components/projekt/bewertungsabruf-logik.js';

const bewertung = { wert: 114000000, bewertungsdatum: '2026-08-16', konfidenzklasse: 'good' };

describe('abrufWarnungstext', () => {
  it('behauptet bei einem einzigen Referenzobjekt keine uebernommenen uebrigen Bewertungen', () => {
    expect(abrufWarnungstext('R1', [{ id: 'R1' }]))
      .toBe('Für den Referenzobjekttyp R1 liegt keine Bewertung vor.');
  });

  it('nennt die uebrigen nur, wenn ein anderes Referenzobjekt tatsaechlich eine Bewertung traegt', () => {
    expect(abrufWarnungstext('R2', [{ id: 'R1', bewertung }, { id: 'R2' }]))
      .toBe('Für den Referenzobjekttyp R2 liegt keine Bewertung vor. '
        + 'Die übrigen Bewertungen wurden übernommen.');
  });

  it('zaehlt ein anderes Referenzobjekt ohne Bewertung nicht als uebernommen', () => {
    expect(abrufWarnungstext('R2', [{ id: 'R1' }, { id: 'R2' }]))
      .toBe('Für den Referenzobjekttyp R2 liegt keine Bewertung vor.');
  });

  it('zeigt einen Gedankenstrich, wenn der fehlgeschlagene Typ nicht benannt ist', () => {
    expect(abrufWarnungstext(undefined, [{ id: 'R1' }]))
      .toBe('Für den Referenzobjekttyp — liegt keine Bewertung vor.');
  });
});
