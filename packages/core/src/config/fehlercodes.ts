/**
 * Keine Formel — Fehlercode-Namensraum der Konfiguration (Spec 02 §3.0, E-16).
 * CFG_* gilt ausschliesslich fuer LADEZEIT-Fehler. Laufzeit-Vorbedingungen der
 * Pipeline-Stufen tragen einen eigenen Namensraum; wo derselbe Sachverhalt
 * bereits zur Ladezeit feststellbar ist, ist der CFG_*-Code der frueher
 * greifende.
 *
 * Fehler tragen strukturierte Parameter, keinen Fliesstext (E-03): Anzeigetexte
 * entstehen in der Uebersetzungsschicht, nicht im Kern.
 */

export type Pruefebene = 1 | 2 | 3;

export const CFG_CODES = [
  // Ebene 1 — Struktur
  'CFG_SCHEMA_MISSING',
  'CFG_SCHEMA_TYPE',
  'CFG_SCHEMA_UNKNOWN_KEY',
  'CFG_SCHEMA_VERSION',
  'CFG_STRATEGY_UNKNOWN',
  // Ebene 2 — lokale Wertebereiche
  'CFG_ALPHA_RANGE',
  'CFG_ADJUSTMENT_BOUNDS',
  'CFG_REASON_MIN_LENGTH',
  'CFG_WEIGHT_RANGE',
  'CFG_NORM_BOUNDS',
  'CFG_TIER_VALUE_RANGE',
  'CFG_G_RANGE',
  'CFG_API_PARAM',
  // Ebene 3 — fachliche Invarianten
  'CFG_WEIGHTS_SUM',
  'CFG_TIER_ORDER',
  'CFG_TIER_OPEN',
  'CFG_TIER_DEGRESSION',
  'CFG_NET_DEGRESSION',
  'CFG_G_ORDER',
  'CFG_ZSCORE_CAP',
  'CFG_SOURCE_UNRESOLVED',
  'CFG_TEMPLATE_BOUNDS',
  'CFG_BEREICHSREGEL',
  'CFG_MERKMAL_DUPLICATE',
  'CFG_MERGE_LOCKED_PATH',
] as const;

export type CfgFehlerCode = (typeof CFG_CODES)[number];

export const CFG_EBENE: Readonly<Record<CfgFehlerCode, Pruefebene>> = {
  CFG_SCHEMA_MISSING: 1,
  CFG_SCHEMA_TYPE: 1,
  CFG_SCHEMA_UNKNOWN_KEY: 1,
  CFG_SCHEMA_VERSION: 1,
  CFG_STRATEGY_UNKNOWN: 1,
  CFG_ALPHA_RANGE: 2,
  CFG_ADJUSTMENT_BOUNDS: 2,
  CFG_REASON_MIN_LENGTH: 2,
  CFG_WEIGHT_RANGE: 2,
  CFG_NORM_BOUNDS: 2,
  CFG_TIER_VALUE_RANGE: 2,
  CFG_G_RANGE: 2,
  CFG_API_PARAM: 2,
  CFG_WEIGHTS_SUM: 3,
  CFG_TIER_ORDER: 3,
  CFG_TIER_OPEN: 3,
  CFG_TIER_DEGRESSION: 3,
  CFG_NET_DEGRESSION: 3,
  CFG_G_ORDER: 3,
  CFG_ZSCORE_CAP: 3,
  CFG_SOURCE_UNRESOLVED: 3,
  CFG_TEMPLATE_BOUNDS: 3,
  CFG_BEREICHSREGEL: 3,
  CFG_MERKMAL_DUPLICATE: 3,
  CFG_MERGE_LOCKED_PATH: 3,
};

export type Fehlerparameter = Readonly<Record<string, string | number | boolean>>;

export interface KonfigurationsFehler {
  readonly code: CfgFehlerCode;
  readonly ebene: Pruefebene;
  readonly pfad: string;
  readonly parameter: Fehlerparameter;
}

export function fehler(
  code: CfgFehlerCode,
  pfad: string,
  parameter: Fehlerparameter = {},
): KonfigurationsFehler {
  return { code, ebene: CFG_EBENE[code], pfad, parameter };
}

export function istKonfigurationsFehler(wert: unknown): wert is KonfigurationsFehler {
  if (typeof wert !== 'object' || wert === null) return false;
  const kandidat = wert as { code?: unknown; pfad?: unknown; parameter?: unknown };
  return (
    typeof kandidat.code === 'string'
    && (CFG_CODES as readonly string[]).includes(kandidat.code)
    && typeof kandidat.pfad === 'string'
    && typeof kandidat.parameter === 'object'
    && kandidat.parameter !== null
  );
}
