import { describe, expect, it } from 'vitest';
import { backoffWartezeitMs } from '../src/client/backoff.js';
import { bewerteRetryAfter, leseRetryAfterMs } from '../src/client/retryAfter.js';
import { erzeugeZufallsquelle } from '../src/client/zufall.js';
import { testKonfiguration } from './testKonfiguration.js';

describe('Backoff (Spec 04 §6.2, §6.3)', () => {
  const ohneJitter = testKonfiguration({
    retry: { ...testKonfiguration().retry, jitter: 'keiner' },
  }).retry;

  it('verdoppelt die Wartezeit gemaess konfiguriertem Faktor', () => {
    const quelle = erzeugeZufallsquelle(1);
    expect(backoffWartezeitMs(1, ohneJitter, quelle)).toBe(500);
    expect(backoffWartezeitMs(2, ohneJitter, quelle)).toBe(1000);
    expect(backoffWartezeitMs(3, ohneJitter, quelle)).toBe(2000);
  });

  it('deckelt bei maxBackoffMs', () => {
    const quelle = erzeugeZufallsquelle(1);
    expect(backoffWartezeitMs(9, ohneJitter, quelle)).toBe(8000);
  });

  it('folgt bei geaenderter Konfiguration den geaenderten Werten (AK-7)', () => {
    const andere = testKonfiguration({
      retry: {
        ...testKonfiguration().retry,
        jitter: 'keiner',
        startBackoffMs: 100,
        backoffFaktor: 3,
      },
    }).retry;
    const quelle = erzeugeZufallsquelle(1);
    expect(backoffWartezeitMs(1, andere, quelle)).toBe(100);
    expect(backoffWartezeitMs(2, andere, quelle)).toBe(300);
  });

  it('haelt den Full Jitter im Intervall [0, backoff) und ist bei gleichem Seed gleich', () => {
    const mitJitter = testKonfiguration().retry;
    const a = erzeugeZufallsquelle(7);
    const b = erzeugeZufallsquelle(7);
    const folgeA = [1, 2, 3].map((n) => backoffWartezeitMs(n, mitJitter, a));
    const folgeB = [1, 2, 3].map((n) => backoffWartezeitMs(n, mitJitter, b));
    expect(folgeA).toEqual(folgeB);
    expect(folgeA[0]).toBeGreaterThanOrEqual(0);
    expect(folgeA[0]).toBeLessThan(500);
  });
});

describe('Retry-After (Spec 04 §6.4)', () => {
  const jetzt = Date.parse('2026-08-16T10:00:00Z');

  it('liest eine Sekundenangabe', () => {
    expect(leseRetryAfterMs('30', jetzt)).toBe(30_000);
  });

  it('liest ein HTTP-Datum als Restdauer', () => {
    expect(leseRetryAfterMs('Sun, 16 Aug 2026 10:00:45 GMT', jetzt)).toBe(45_000);
  });

  it('liefert undefined bei fehlendem oder unlesbarem Header', () => {
    expect(leseRetryAfterMs(null, jetzt)).toBeUndefined();
    expect(leseRetryAfterMs('bald', jetzt)).toBeUndefined();
  });

  it('wartet bei einem Wert unterhalb der Schwelle', () => {
    const entscheid = bewerteRetryAfter('30', jetzt, testKonfiguration().retry);
    expect(entscheid).toEqual({ modus: 'warten', wartezeitMs: 30_000 });
  });

  it('bricht oberhalb von retryAfterMaxSekunden sofort ab', () => {
    const entscheid = bewerteRetryAfter('120', jetzt, testKonfiguration().retry);
    expect(entscheid).toEqual({ modus: 'aufgeben', wiederholbarNachSek: 120 });
  });

  it('faellt ohne Header auf den regulaeren Backoff zurueck', () => {
    expect(bewerteRetryAfter(null, jetzt, testKonfiguration().retry)).toEqual({
      modus: 'backoff',
    });
  });

  it('ignoriert den Header, wenn retryAfterBeachten false ist', () => {
    const retry = { ...testKonfiguration().retry, retryAfterBeachten: false };
    expect(bewerteRetryAfter('30', jetzt, retry)).toEqual({ modus: 'backoff' });
  });
});
