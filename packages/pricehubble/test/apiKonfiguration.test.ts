import { describe, expect, it } from 'vitest';
import {
  pruefeApiKonfiguration,
  pruefeUmgebung,
} from '../src/config/apiKonfiguration.js';
import { KonfigurationsFehler } from '../src/config/konfigurationsFehler.js';
import { testKonfiguration } from './testKonfiguration.js';

describe('Initialisierungspruefung (Spec 04 §2 Regel 2, §6.2)', () => {
  it('akzeptiert eine vollstaendige Konfiguration', () => {
    expect(() => pruefeApiKonfiguration(testKonfiguration())).not.toThrow();
  });

  it('weist maxVersuche < 1 als KonfigurationsFehler zurueck', () => {
    const k = testKonfiguration();
    const kaputt = { ...k, retry: { ...k.retry, maxVersuche: 0 } };
    expect(() => pruefeApiKonfiguration(kaputt)).toThrow(KonfigurationsFehler);
  });

  it('weist ein nichtpositives Zeitlimit zurueck', () => {
    const kaputt = { ...testKonfiguration(), timeoutMs: 0 };
    expect(() => pruefeApiKonfiguration(kaputt)).toThrow(/timeoutMs/);
  });

  it('weist backoffFaktor < 1 zurueck', () => {
    const k = testKonfiguration();
    const kaputt = { ...k, retry: { ...k.retry, backoffFaktor: 0.5 } };
    expect(() => pruefeApiKonfiguration(kaputt)).toThrow(/backoffFaktor/);
  });

  it('verlangt bei VALUATION_PROVIDER=pricehubble die drei Zugangsvariablen', () => {
    expect(() =>
      pruefeUmgebung({
        VALUATION_PROVIDER: 'pricehubble',
        PH_USERNAME: 'a',
        PH_PASSWORD: 'b',
      }),
    ).toThrow(/PH_DOSSIER_ID/);
  });

  it('verlangt bei VALUATION_PROVIDER=mock keine Zugangsvariablen', () => {
    expect(() => pruefeUmgebung({ VALUATION_PROVIDER: 'mock' })).not.toThrow();
  });

  it('behandelt einen unbekannten Provider-Wert als KonfigurationsFehler', () => {
    expect(() => pruefeUmgebung({ VALUATION_PROVIDER: 'echt' })).toThrow(
      KonfigurationsFehler,
    );
  });

  it('nennt in der Fehlermeldung niemals das Passwort', () => {
    try {
      pruefeUmgebung({ VALUATION_PROVIDER: 'pricehubble', PH_PASSWORD: 'geheim' });
    } catch (fehler) {
      expect(String(fehler)).not.toContain('geheim');
    }
  });
});
