import { describe, expect, it } from 'vitest';
import { dateiname } from '../../src/server/pdf-dateiname.js';

describe('PDF-Dateiname', () => {
  it('benennt die Datei nach Referenznummer und Erstellungsdatum', () => {
    expect(dateiname({ referenznummer: 'A-2026-014', erstelltAm: '2026-08-16T14:32:00.000Z' }))
      .toBe('A-2026-014_2026-08-16.pdf');
  });
});
