/**
 * Keine Formel. Die neun adapterinternen Fehlertypen des Abrufpfads.
 * Der zehnte Typ, `KonfigurationsFehler`, liegt auf dem Initialisierungspfad und
 * steht bewusst nicht in dieser Aufzaehlung (E-02).
 *
 * Die Reihenfolge ist verbindlich: Sie ist zugleich die Zeilenfolge der
 * Abbildungstabelle in `acl/fehler-uebersetzung.ts`.
 */
export const ADAPTER_FEHLERARTEN = [
  'AuthError',
  'NetworkError',
  'TimeoutError',
  'RateLimitError',
  'ClientError',
  'NotFoundError',
  'ServerError',
  'ContractViolation',
  'StaleValuationError',
] as const;

export type AdapterFehlerArt = (typeof ADAPTER_FEHLERARTEN)[number];

/** Logischer Endpunktname — kein URL-Aufbau, damit kein HTTP-Wissen nach aussen dringt. */
export type EndpunktName =
  | 'login'
  | 'dossierGet'
  | 'dossierUpdate'
  | 'dossierValuation'
  | 'locationScores';

// `| undefined` explizit: exactOptionalPropertyTypes unterscheidet fehlendes Feld von
// Feld mit Wert undefined; der Client setzt die Diagnosefelder einheitlich.
export interface AdapterFehler {
  readonly art: AdapterFehlerArt;
  readonly endpunkt: EndpunktName;
  readonly httpStatus?: number | undefined;
  readonly phRequestId?: string | undefined;
  readonly versuche: number;
  readonly dauerMs: number;
  /** NIE ungefiltert an den Vermarkter durchgereicht (NFA-11). */
  readonly detail: string;
  readonly feld?: string | undefined;
  readonly wiederholbarNachSek?: number | undefined;
  /** feinerer Grundcode innerhalb einer Zielvariante, z. B. Schema vs. Stale. */
  readonly grundcode?: string | undefined;
}
