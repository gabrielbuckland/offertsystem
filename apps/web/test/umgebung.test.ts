import { describe, expect, it } from 'vitest';
import { leseUmgebung } from '../src/server/umgebung.js';

describe('leseUmgebung', () => {
  it('nimmt mock als Vorgabe, wenn VALUATION_PROVIDER fehlt', () => {
    const ergebnis = leseUmgebung({});
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.valuationProvider).toBe('mock');
    expect(ergebnis.wert.companyDefaultsPfad).toBe('./config/company-defaults.json');
  });

  it('weist einen unbekannten Schalterwert zurueck', () => {
    const ergebnis = leseUmgebung({ VALUATION_PROVIDER: 'live' });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldungen.join(' ')).toContain('VALUATION_PROVIDER');
  });

  it('bricht bei pricehubble ohne Zugangsdaten ab, ohne auf Ersatzwerte zurueckzufallen', () => {
    const ergebnis = leseUmgebung({ VALUATION_PROVIDER: 'pricehubble' });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldungen).toHaveLength(4);
    expect(ergebnis.meldungen.join(' ')).toContain('PH_DOSSIER_ID');
  });

  it('akzeptiert pricehubble mit vollstaendigen Zugangsdaten', () => {
    const ergebnis = leseUmgebung({
      VALUATION_PROVIDER: 'pricehubble',
      PH_BASE_URL: 'https://api.pricehubble.com',
      PH_USERNAME: 'benutzer',
      PH_PASSWORD: 'geheim',
      PH_DOSSIER_ID: '4711',
    });
    expect(ergebnis.ok).toBe(true);
  });
});
