import { describe, expect, it } from 'vitest';
import { dateiname } from '../../src/server/pdf-dateiname.js';

describe('PDF-Dateiname', () => {
  it('benennt die Datei nach den ersten acht Zeichen der Offert-Kennung und dem Erstellungsdatum', () => {
    expect(dateiname({
      offertId: '11111111-1111-4111-8111-111111111111',
      erstelltAm: '2026-08-16T14:32:00.000Z',
    })).toBe('11111111_2026-08-16.pdf');
  });
});
