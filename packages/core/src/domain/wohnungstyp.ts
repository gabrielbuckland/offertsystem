// Keine Formel. Verbindliche Feldliste der Dossier-Parametrisierung (E-28); der Adapter
// sendet ausschliesslich daraus, die Oberflaeche erfasst ausschliesslich daraus.
// VORLAEUFIG bis zur Fixture-Aufzeichnung M-FIX (Brief §7, O-07).
import type { Quadratmeter } from './geld.js';
import type { WohnungstypId } from './ids.js';

export interface RepraesentativeParametrisierung {
  readonly flaecheInnen: Quadratmeter;
  readonly flaecheAussen: Quadratmeter;
  readonly stockwerk: number;
  readonly energielabel: string;
  readonly zustandsbewertungen: Readonly<Record<string, string>>;
  readonly qualitaetsbewertungen: Readonly<Record<string, string>>;
  readonly anzahlBadezimmer: number;
  readonly lift: boolean;
  readonly baujahr: number;
  readonly heizungsart: string;
}

export interface Wohnungstyp {
  readonly id: WohnungstypId;
  readonly zimmerzahl: number; // fachliche Identitaet (US-02), 1..12
  readonly parametrisierung: RepraesentativeParametrisierung;
}
