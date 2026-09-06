import { describe, expect, it } from 'vitest';
import {
  EINGEBAUTE_MERKMALE, leseMerkmalswert, waehlbareMerkmale,
} from '../../src/server/eingebaute-merkmale.js';

const einheit = (merkmalswerte: Record<string, number> = {}) => ({
  flaecheInnen: 86, flaecheAussen: 19, merkmalswerte,
});

describe('leseMerkmalswert', () => {
  it('liest die Flaechenmerkmale direkt aus den Einheitsfeldern', () => {
    expect(leseMerkmalswert(einheit(), 'flaecheInnen')).toBe(86);
    expect(leseMerkmalswert(einheit(), 'flaecheAussen')).toBe(19);
  });

  it('liest ein konfiguriertes Merkmal aus den erfassten Merkmalswerten', () => {
    expect(leseMerkmalswert(einheit({ stockwerk: 3 }), 'stockwerk')).toBe(3);
  });

  it('liefert undefined fuer ein nicht erfasstes Merkmal', () => {
    expect(leseMerkmalswert(einheit(), 'stockwerk')).toBeUndefined();
  });

  it('laesst bei einer id-Kollision das Einheitsfeld gewinnen', () => {
    expect(leseMerkmalswert(einheit({ flaecheInnen: 999 }), 'flaecheInnen')).toBe(86);
  });
});

describe('waehlbareMerkmale', () => {
  it('stellt die konfigurierten Merkmale vor die eingebauten', () => {
    const konfiguriert = [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' as const }];
    expect(waehlbareMerkmale(konfiguriert).map((m) => m.id))
      .toEqual(['stockwerk', ...EINGEBAUTE_MERKMALE.map((m) => m.id)]);
  });

  it('fuehrt ein konfiguriertes Merkmal mit eingebauter id nicht doppelt', () => {
    const konfiguriert = [{ id: 'flaecheInnen', bezeichnung: 'Doppelt', form: 'zahl' as const }];
    const ids = waehlbareMerkmale(konfiguriert).map((m) => m.id);
    expect(ids.filter((id) => id === 'flaecheInnen')).toHaveLength(1);
  });
});
