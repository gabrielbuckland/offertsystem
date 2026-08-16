/**
 * Keine Formel. Die neun adapterinternen Fehlertypen des Abrufpfads (Spec 04 §6.5.1).
 * Der zehnte Typ, `KonfigurationsFehler`, liegt auf dem Initialisierungspfad und
 * steht bewusst nicht in dieser Aufzaehlung (§6.5.3, E-02).
 *
 * Die Reihenfolge ist verbindlich: Sie ist zugleich die Zeilenfolge der
 * Abbildungstabelle in `acl/fehlerUebersetzung.ts`.
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

export interface AdapterFehler {
  readonly art: AdapterFehlerArt;
  readonly endpunkt: EndpunktName;
  readonly httpStatus?: number;
  readonly phRequestId?: string;
  /** einschliesslich des ersten Versuchs */
  readonly versuche: number;
  /** bis zur endgueltigen Aufgabe */
  readonly dauerMs: number;
  /** interner Grund; wird NIE ungefiltert an den Vermarkter durchgereicht (NFA-11) */
  readonly detail: string;
  /** vom Anbieter beanstandetes Feld, falls geliefert (nur bei ClientError) */
  readonly feld?: string;
  /** Wartedauer aus Retry-After, falls ermittelt (nur bei RateLimitError) */
  readonly wiederholbarNachSek?: number;
  /** feinerer Grundcode innerhalb einer Zielvariante, z. B. Schema vs. Stale */
  readonly grundcode?: string;
}

export function erzeugeAdapterFehler(fehler: AdapterFehler): AdapterFehler {
  return fehler;
}
