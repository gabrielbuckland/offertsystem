// Keine Formel. Aggregate Root; I-01 wird an genau dieser Stelle durchgesetzt.
// Die Referenzbewertung liegt bewusst NICHT im Wohnungstyp, sondern in einer eigenen
// Abbildung.
import type { Adresse } from './adresse.js';
import type { Einheit } from './einheit.js';
import type { LiegenschaftId } from './ids.js';
import type { Wohnungstyp } from './wohnungstyp.js';
import { fehlschlag, ok, type Result } from './result.js';

declare const gueltig: unique symbol;

export interface LiegenschaftEntwurf {
  readonly id: LiegenschaftId;
  readonly adresse: Adresse;
  readonly wohnungstypen: readonly Wohnungstyp[];
  readonly einheiten: readonly Einheit[];
}

// Nur erzeugeLiegenschaft vergibt die Gueltigkeitsmarke.
export type Liegenschaft = LiegenschaftEntwurf & { readonly [gueltig]: true };

export type AggregatFehlerCode =
  | 'WOHNUNGSNUMMER_DOPPELT'
  | 'WOHNUNGSTYP_UNBEKANNT'
  | 'ZIMMERZAHL_MEHRFACH'
  | 'WOHNUNGSTYP_OHNE_EINHEIT'
  | 'KEINE_EINHEIT';

export interface AggregatFehler {
  readonly code: AggregatFehlerCode;
  readonly parameter: Readonly<Record<string, string | number | readonly string[]>>;
}

export function erzeugeLiegenschaft(
  roh: LiegenschaftEntwurf,
): Result<Liegenschaft, readonly AggregatFehler[]> {
  const fehler: AggregatFehler[] = [];

  if (roh.einheiten.length === 0) {
    fehler.push({ code: 'KEINE_EINHEIT', parameter: { liegenschaftId: roh.id } });
  }

  const gesehen = new Set<string>();
  const doppelte: string[] = [];
  for (const e of roh.einheiten) {
    if (gesehen.has(e.wohnungsnummer)) doppelte.push(e.wohnungsnummer);
    gesehen.add(e.wohnungsnummer);
  }
  if (doppelte.length > 0) {
    fehler.push({ code: 'WOHNUNGSNUMMER_DOPPELT', parameter: { wohnungsnummern: doppelte } });
  }

  const typIds = new Set(roh.wohnungstypen.map((t) => t.id as string));
  const unbekannt = roh.einheiten
    .filter((e) => !typIds.has(e.wohnungstypId))
    .map((e) => `${e.wohnungsnummer}:${e.wohnungstypId}`);
  if (unbekannt.length > 0) {
    fehler.push({ code: 'WOHNUNGSTYP_UNBEKANNT', parameter: { einheiten: unbekannt } });
  }

  const jeZimmerzahl = new Map<number, string[]>();
  for (const t of roh.wohnungstypen) {
    jeZimmerzahl.set(t.zimmerzahl, [...(jeZimmerzahl.get(t.zimmerzahl) ?? []), t.id]);
  }
  const mehrfach = [...jeZimmerzahl.entries()].filter(([, ids]) => ids.length > 1);
  if (mehrfach.length > 0) {
    fehler.push({
      code: 'ZIMMERZAHL_MEHRFACH',
      parameter: { zimmerzahlen: mehrfach.map(([z, ids]) => `${z}:${ids.join(',')}`) },
    });
  }

  const belegt = new Set(roh.einheiten.map((e) => e.wohnungstypId as string));
  const leer = roh.wohnungstypen.filter((t) => !belegt.has(t.id)).map((t) => t.id as string);
  if (leer.length > 0) {
    fehler.push({ code: 'WOHNUNGSTYP_OHNE_EINHEIT', parameter: { wohnungstypen: leer } });
  }

  if (fehler.length > 0) return fehlschlag(fehler);
  return ok(roh as Liegenschaft);
}
