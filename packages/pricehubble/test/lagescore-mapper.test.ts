import type { LagescoreName } from '@offert/core';
import { describe, expect, it } from 'vitest';
import { aufLagescores } from '../src/acl/lagescore-mapper.js';
import { LocationScoresResponseSchema } from '../src/schema/location-scores-response.js';
import { ladeFixture } from './fixtures.js';

const antwort = LocationScoresResponseSchema.parse(
  ladeFixture('synthetic/location/location-scores.success.json'),
);

describe('ACL-Mapping der Lagescores (Spec 04 §4.2, E-08, I-26)', () => {
  it('liefert alle neun Scores einzeln und ungerundet', () => {
    const scores = aufLagescores(antwort, '2026-08-16');
    expect(scores.werte.size).toBe(9);
    expect(scores.werte.get('location' as LagescoreName)).toBe(0.82);
    expect(scores.werte.get('nuisance' as LagescoreName)).toBe(0.79);
  });

  it('verdichtet nicht zu einem Sammelwert (I-26, AK-14)', () => {
    const scores = aufLagescores(antwort, '2026-08-16');
    expect(Object.keys(scores)).toEqual(['werte', 'meta', 'abrufdatum', 'anbieter']);
    expect([...scores.werte.keys()]).not.toContain('gesamt');
  });

  it('polt noise und nuisance NICHT um (I-13, Umpolung nur ueber Konfiguration)', () => {
    const scores = aufLagescores(antwort, '2026-08-16');
    expect(scores.werte.get('noise' as LagescoreName)).toBe(0.62);
  });

  it('fuehrt originalScore und isOverridden in meta', () => {
    const uebersteuert = LocationScoresResponseSchema.parse(
      ladeFixture('synthetic/location/location-scores.overridden.json'),
    );
    const scores = aufLagescores(uebersteuert, '2026-08-16');
    expect(scores.werte.get('location' as LagescoreName)).toBe(0.95);
    expect(scores.meta.get('location' as LagescoreName)).toEqual({
      originalScore: 0.82,
      isOverridden: true,
    });
  });

  it('setzt Herkunft und Abrufdatum', () => {
    const scores = aufLagescores(antwort, '2026-08-16');
    expect(scores.anbieter).toBe('pricehubble');
    expect(scores.abrufdatum).toBe('2026-08-16');
  });
});
