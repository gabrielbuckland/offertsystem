import { describe, expect, it } from 'vitest';
import {
  offertDokumentSchema, sammlePlatzhalterIds,
} from '../../src/vorlage/dokument-schema.js';
import { PLATZHALTER_KATALOG } from '../../src/vorlage/platzhalter.js';
import { standardVorlage } from '../../src/vorlage/standard-vorlage.js';

describe('standardVorlage', () => {
  it('ist schemakonform', () => {
    expect(() => offertDokumentSchema.parse(standardVorlage())).not.toThrow();
  });

  it('verwendet ausschliesslich Katalog-Platzhalter', () => {
    const katalog = new Set<string>(PLATZHALTER_KATALOG.map((e) => e.id));
    for (const vorkommen of sammlePlatzhalterIds(standardVorlage())) {
      expect(katalog.has(vorkommen.id)).toBe(true);
    }
  });

  it('deckt die Neubau-Struktur ab: Ausgangslage, Konzept, Pricing, Honorar, Schluss', () => {
    const text = JSON.stringify(standardVorlage());
    for (const titel of ['Ausgangslage', 'Konzeptioneller Ansatz', 'Pricing',
      'Dienstleistungs- und Honorarangebot']) {
      expect(text).toContain(titel);
    }
    // Kernplatzhalter der Neubau-Vermarktung sind eingebunden.
    const vorkommen = sammlePlatzhalterIds(standardVorlage());
    for (const id of ['ort', 'anzahlEinheiten', 'verkaufssumme',
      'honorar', 'honorarBetrag', 'preistabelle', 'auftraggeber']) {
      expect(vorkommen.some((v) => v.id === id)).toBe(true);
    }
    // Kein Mieter-/Umnutzungsrest aus dem Beispiel.
    expect(text).not.toContain('Mieter');
    expect(text).not.toContain('Umnutzung');
  });
});
