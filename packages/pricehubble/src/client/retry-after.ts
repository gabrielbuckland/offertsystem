/** Keine Formel. Auswertung des `Retry-After`-Headers (Spec 04 §6.4). */
import type { RetryKonfiguration } from '../config/api-konfiguration.js';

export type RetryAfterEntscheid =
  | { readonly modus: 'warten'; readonly wartezeitMs: number }
  | { readonly modus: 'aufgeben'; readonly wiederholbarNachSek: number }
  | { readonly modus: 'backoff' };

/**
 * `Retry-After` ist entweder eine Sekundenzahl oder ein HTTP-Datum (RFC 9110).
 * Der Header ist in der Bruno-Beispielantwort NICHT belegt; er wird deshalb als
 * optional vorhanden behandelt (Spec 04 §1.7, Nachweisluecke G-2).
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
 * aufgegeben (Spec 04 §6.4 Punkt 2, D-6): Der Vermarkter arbeitet interaktiv, und eine
 * Blockade von Minuten waere fuer ihn von einem Haenger nicht unterscheidbar. Die
 * Abweichung von US-15 ist als Nachfuehrungsbedarf N-12 ausgewiesen.
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
