// Keine Formel. Verbindliche Feldliste der Dossier-Parametrisierung (E-28); der Adapter
// sendet ausschliesslich daraus, die Oberflaeche erfasst ausschliesslich daraus.
// Aufzaehlungswerte und Wertebereiche gegen die echte API verifiziert (2026-09-01).
import type {
  Energielabel, Heizungsart, Qualitaetsbewertungen, Zustandsbewertungen,
} from '../config/bewertungen.js';
import type { Quadratmeter } from './geld.js';
import type { WohnungstypId } from './ids.js';

export interface RepraesentativeParametrisierung {
  readonly flaecheInnen: Quadratmeter;
  readonly flaecheAussen: Quadratmeter;
  readonly stockwerk: number;
  readonly energielabel: Energielabel;
  readonly zustandsbewertungen: Zustandsbewertungen;
  readonly qualitaetsbewertungen: Qualitaetsbewertungen;
  readonly anzahlBadezimmer: number;
  readonly lift: boolean;
  readonly baujahr: number;
  readonly heizungsart: Heizungsart;
}

export interface Wohnungstyp {
  readonly id: WohnungstypId;
  readonly zimmerzahl: number; // fachliche Identitaet (US-02), 1..12
  readonly parametrisierung: RepraesentativeParametrisierung;
}
