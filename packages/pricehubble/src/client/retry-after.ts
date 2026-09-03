/** Keine Formel. Auswertung des `Retry-After`-Headers. */
import type { RetryKonfiguration } from '../config/api-konfiguration.js';

export type RetryAfterEntscheid =
  | { readonly modus: 'warten'; readonly wartezeitMs: number }
  | { readonly modus: 'aufgeben'; readonly wiederholbarNachSek: number }
  | { readonly modus: 'backoff' };

/**
 * `Retry-After` ist entweder eine Sekundenzahl oder ein HTTP-Datum (RFC 9110).
 * Der Header ist in der Bruno-Beispielantwort NICHT belegt; er wird deshalb als
 * optional vorhanden behandelt.
 */
export function leseRetryAfterMs(
  header: string | null | undefined,
  jetztMs: number,
): number | undefined {
  if (header === null || header === undefined) {
    return undefined;
  }
  const wert = header.trim();
  if (/^\d+$/.test(wert)) {
    return Number(wert) * 1000;
  }
  const zeitpunkt = Date.parse(wert);
  if (Number.isNaN(zeitpunkt)) {
    return undefined;
  }
  return Math.max(0, zeitpunkt - jetztMs);
}

/**
 * Oberhalb von `api.retry.retryAfterMaxSekunden` wird nicht gewartet, sondern sofort
 * aufgegeben: Der Vermarkter arbeitet interaktiv, und eine Blockade von Minuten waere
 * fuer ihn von einem Haenger nicht unterscheidbar. Bewusste Abweichung von US-15.
 */
export function bewerteRetryAfter(
  header: string | null | undefined,
  jetztMs: number,
  retry: RetryKonfiguration,
): RetryAfterEntscheid {
  if (!retry.retryAfterBeachten) {
    return { modus: 'backoff' };
  }
  const wartezeitMs = leseRetryAfterMs(header, jetztMs);
  if (wartezeitMs === undefined) {
    return { modus: 'backoff' };
  }
  if (wartezeitMs > retry.retryAfterMaxSekunden * 1000) {
    return { modus: 'aufgeben', wiederholbarNachSek: Math.ceil(wartezeitMs / 1000) };
  }
  return { modus: 'warten', wartezeitMs };
}
