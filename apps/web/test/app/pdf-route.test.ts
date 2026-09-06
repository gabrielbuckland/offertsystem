import { describe, expect, it } from 'vitest';
import { druckBasisUrl } from '../../src/server/druck-basis-url.js';
import { dateiname } from '../../src/server/pdf-dateiname.js';

describe('PDF-Dateiname', () => {
  it('benennt die Datei nach den ersten acht Zeichen der Offert-Kennung und dem Erstellungsdatum', () => {
    expect(dateiname({
      offertId: '11111111-1111-4111-8111-111111111111',
      erstelltAm: '2026-08-16T14:32:00.000Z',
    })).toBe('11111111_2026-08-16.pdf');
  });
});

describe('Druck-Basis-URL', () => {
  it('leitet die Basis-URL aus dem Ursprung der Anfrage ab, damit der Druck auf jedem Port funktioniert', () => {
    expect(druckBasisUrl('http://localhost:3111/api/offerte/x/pdf', {}))
      .toBe('http://localhost:3111');
  });

  it('laesst APP_BASE_URL den Ursprung uebersteuern', () => {
    expect(druckBasisUrl('http://localhost:3111/api/offerte/x/pdf',
                         { APP_BASE_URL: 'https://offert.example' }))
      .toBe('https://offert.example');
  });

  it('behandelt eine leere APP_BASE_URL wie eine fehlende', () => {
    expect(druckBasisUrl('http://localhost:3111/api/offerte/x/pdf', { APP_BASE_URL: '' }))
      .toBe('http://localhost:3111');
  });
});
