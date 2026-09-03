/**
 * Keine Formel. Benutzerverstaendliche Meldungen (NFA-11).
 *
 * Sie entstehen im ACL — das ist die in E-03 benannte Ausnahme von der Regel, dass
 * Fehlertexte nicht im Kern entstehen: Es geht um Meldungen eines Fremddienstes, die
 * nicht ungefiltert durchgereicht werden duerfen. Die Oberflaeche formatiert nur noch.
 */
import type { AdapterFehlerArt } from '../client/fehler.js';

export const MELDUNGEN: Readonly<Record<AdapterFehlerArt, string>> = {
  AuthError: 'Anmeldung bei PriceHubble fehlgeschlagen. Zugangsdaten pruefen.',
  NetworkError: 'PriceHubble ist derzeit nicht erreichbar.',
  TimeoutError: 'PriceHubble hat nicht rechtzeitig geantwortet.',
  RateLimitError: 'Abfragelimit erreicht. Bitte spaeter erneut versuchen.',
  ClientError: 'Die Objektangaben wurden von PriceHubble nicht akzeptiert.',
  NotFoundError: 'Das hinterlegte PriceHubble-Dossier existiert nicht.',
  ServerError: 'PriceHubble meldet eine Stoerung.',
  ContractViolation:
    'Die Antwort von PriceHubble hatte ein unerwartetes Format. Es wurde keine Berechnung durchgefuehrt.',
  StaleValuationError:
    'Die Bewertung konnte fuer die geaenderten Angaben nicht aktualisiert werden.',
};
