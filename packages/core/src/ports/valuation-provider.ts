// Keine Formel. Einziger Zugang des Kerns zu Bewertungsdaten (I-23, NFA-01, NFA-02).
// Fassung nach E-01 (deutsche Namen, Batch-Aritaet), Fehlerkontrakt nach E-02.
import type { Adresse } from '../domain/adresse.js';
import type { Rappen, Score } from '../domain/geld.js';
import type { LagescoreName, WohnungstypId } from '../domain/ids.js';
import type { Result } from '../domain/result.js';
import type { RepraesentativeParametrisierung } from '../domain/wohnungstyp.js';

export type Konfidenzklasse = 'poor' | 'medium' | 'good';

/** Reine Anzeigeinformation. Gelangt NICHT in `PipelineEingang` (Brief §8, E-21). */
export interface BewertungsAnzeige {
  readonly konfidenzbereich: { readonly von: Rappen; readonly bis: Rappen };
  readonly konfidenzklasse: Konfidenzklasse;
  readonly konfidenzwert?: number;
}

export interface Referenzbewertung {
  readonly wohnungstypId: WohnungstypId;
  readonly marktwert: Rappen; // valuationSale.value, bei Uebernahme gerundet (R1)
  readonly bewertungsdatum: string; // ISO-8601, hereingereicht
  readonly anbieter: string;
  readonly parametrisierungsAbdruck: RepraesentativeParametrisierung;
  readonly anzeige: BewertungsAnzeige;
}

export interface LagescoreMeta {
  readonly originalScore: Score;
  readonly isOverridden: boolean;
}

export interface Lagescores {
  readonly werte: ReadonlyMap<LagescoreName, Score>; // I-26: keine Verdichtung
  readonly meta: ReadonlyMap<LagescoreName, LagescoreMeta>;
  readonly abrufdatum: string;
  readonly anbieter: string;
}

export interface FehlerDiagnose {
  readonly endpoint: string; // logischer Endpunktname, kein URL-Aufbau
  readonly httpStatus?: number;
  readonly phRequestId?: string;
  readonly versuche: number; // einschliesslich des ersten
  readonly dauerMs: number;
}

export type ProviderFehler =
  | { readonly art: 'nicht_erreichbar'; readonly detail: string; readonly diagnose: FehlerDiagnose }
  | { readonly art: 'zeitueberschreitung'; readonly detail: string; readonly diagnose: FehlerDiagnose }
  | { readonly art: 'authentifizierung'; readonly detail: string; readonly diagnose: FehlerDiagnose }
  | { readonly art: 'kontingent'; readonly wiederholbarNach?: number; readonly diagnose: FehlerDiagnose }
  | { readonly art: 'anfrage_abgelehnt'; readonly detail: string; readonly feld?: string;
      readonly diagnose: FehlerDiagnose }
  | { readonly art: 'antwort_ungueltig'; readonly detail: string; readonly diagnose: FehlerDiagnose }
  | { readonly art: 'objekt_unbekannt'; readonly detail: string; readonly diagnose: FehlerDiagnose }
  | { readonly art: 'dienst_gestoert'; readonly detail: string; readonly diagnose: FehlerDiagnose };

export interface BewertungsAnfrage {
  readonly adresse: Adresse;
  readonly wohnungstypId: WohnungstypId;
  readonly zimmerzahl: number;
  readonly parametrisierung: RepraesentativeParametrisierung;
}

export interface BewertungsBuendel {
  readonly vollstaendig: boolean;
  readonly bewertungen: ReadonlyMap<WohnungstypId, Referenzbewertung>;
  readonly fehlgeschlagenerTyp?: WohnungstypId;
  readonly fehler?: ProviderFehler;
}

export interface ValuationProvider {
  /** Ein Aufruf je Projekt; intern T Requests (I-27, NFA-12). */
  bewerteWohnungstypen(
    anfragen: readonly BewertungsAnfrage[],
  ): Promise<Result<BewertungsBuendel, ProviderFehler>>;

  /** Einmal je Liegenschaft. */
  holeLagescores(adresse: Adresse): Promise<Result<Lagescores, ProviderFehler>>;
}
