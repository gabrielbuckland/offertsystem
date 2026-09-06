/**
 * Keine Formel. Exponentieller Backoff mit Full Jitter.
 * Saemtliche Parameter stammen aus `config.api.retry.*` — im Code steht keine
 * Zahlenkonstante (E-13).
 */
import type { RetryKonfiguration } from '../config/api-konfiguration.js';
import type { Zufallsquelle } from './zufall.js';

export function backoffWartezeitMs(
  versuchNr: number,
  retry: RetryKonfiguration,
  zufall: Zufallsquelle,
): number {
  const roh = retry.startBackoffMs * retry.backoffFaktor ** (versuchNr - 1);
  const gedeckelt = Math.min(roh, retry.maxBackoffMs);
  if (retry.jitter === 'keiner') {
    return Math.floor(gedeckelt);
  }
  return Math.floor(zufall() * gedeckelt);
}
