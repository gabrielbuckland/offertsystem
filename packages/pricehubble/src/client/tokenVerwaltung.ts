/**
 * Keine Formel. Token-Haltung nach Spec 04 §2.
 *
 * Der Token liegt ausschliesslich im Prozessspeicher — kein DBMS (Brief §5.2) und kein
 * Datei-Cache, weil Geheimnismaterial sonst persistiert wuerde.
 *
 * Die Ablaufzeit wird NICHT aus `expires_in` abgeleitet: Das Feld ist in der
 * Bruno-Beispielantwort nicht belegt (OFFEN-1). Stattdessen gilt
 * `api.tokenGueltigkeitMin` abzueglich `api.tokenSicherheitsmargeMin`.
 */
import type { ApiKonfiguration } from '../config/apiKonfiguration.js';
import { LoginResponseSchema } from '../schema/loginResponse.js';
import type { AdapterFehler } from './fehler.js';
import type { AnfrageBeschreibung, HttpClient, HttpErgebnis } from './httpClient.js';
import type { Uhr } from './uhr.js';

/** Einheitenumrechnung Minuten -> Millisekunden; kein Verhaltensparameter (G-4). */
const MS_JE_MINUTE = 60_000;

export interface Zugangsdaten {
  readonly benutzername: string;
  readonly passwort: string;
}

export interface TokenVerwaltungAbhaengigkeiten {
  readonly client: HttpClient;
  readonly konfiguration: ApiKonfiguration;
  readonly uhr: Uhr;
  readonly zugangsdaten: Zugangsdaten;
}

export type TokenErgebnis =
  | { readonly ok: true; readonly wert: string }
  | { readonly ok: false; readonly fehler: AdapterFehler };

export class TokenVerwaltung {
  // `| undefined` steht ausdruecklich: Unter `exactOptionalPropertyTypes` darf einem
  // rein optionalen Feld nicht `undefined` ZUGEWIESEN werden. Beide Felder werden
  // aber genau so zurueckgesetzt — der Token beim 401-Fall, der laufende Login nach
  // Abschluss.
  private token: string | undefined;
  private gueltigBisMs = 0;
  private laufenderLogin: Promise<TokenErgebnis> | undefined;

  private readonly abh: TokenVerwaltungAbhaengigkeiten;

  // Feldzuweisung statt Parametereigenschaft: `node --experimental-strip-types`
  // (PE-09) uebersetzt nicht, es entfernt nur Typen — Parametereigenschaften
  // haetten eine Codeerzeugung verlangt und sind dort nicht zulaessig.
  public constructor(abh: TokenVerwaltungAbhaengigkeiten) {
    this.abh = abh;
  }

  public async holeToken(): Promise<TokenErgebnis> {
    const { uhr } = this.abh;
    if (this.token !== undefined && uhr.jetztMs() < this.gueltigBisMs) {
      return { ok: true, wert: this.token };
    }
    return this.erzwingeErneuerung();
  }

  /** Kein paralleler Login: Weitere Aufrufer warten auf dasselbe Ergebnis. */
  public async erzwingeErneuerung(): Promise<TokenErgebnis> {
    this.laufenderLogin ??= this.login().finally(() => {
      this.laufenderLogin = undefined;
    });
    return this.laufenderLogin;
  }

  /**
   * Reaktive Erneuerung (Spec 04 §2): Bei 401 wird genau einmal neu eingeloggt und
   * der Request genau einmal wiederholt. Diese Wiederholung ist KEIN Retry im Sinne
   * von §6 und zaehlt nicht gegen `api.retry.maxVersuche`.
   */
  public async mitToken(
    baue: (token: string) => AnfrageBeschreibung,
  ): Promise<HttpErgebnis> {
    const erst = await this.holeToken();
    if (!erst.ok) {
      return { ok: false, fehler: erst.fehler };
    }
    const ergebnis = await this.abh.client.fuehreAus(baue(erst.wert));
    if (ergebnis.ok || ergebnis.fehler.art !== 'AuthError') {
      return ergebnis;
    }
    this.token = undefined;
    const zweit = await this.erzwingeErneuerung();
    if (!zweit.ok) {
      return { ok: false, fehler: zweit.fehler };
    }
    return this.abh.client.fuehreAus(baue(zweit.wert));
  }

  private async login(): Promise<TokenErgebnis> {
    const { client, konfiguration, uhr, zugangsdaten } = this.abh;
    const antwort = await client.fuehreAus({
      endpunkt: 'login',
      methode: 'POST',
      url: `${konfiguration.baseUrl}${konfiguration.endpunkte.login}`,
      body: { username: zugangsdaten.benutzername, password: zugangsdaten.passwort },
      timeoutMs: konfiguration.timeoutMs,
    });
    if (!antwort.ok) {
      return { ok: false, fehler: antwort.fehler };
    }
    const geprueft = LoginResponseSchema.safeParse(antwort.wert.rumpf);
    if (!geprueft.success) {
      return {
        ok: false,
        fehler: {
          art: 'ContractViolation',
          endpunkt: 'login',
          versuche: 1,
          dauerMs: 0,
          httpStatus: antwort.wert.httpStatus,
          phRequestId: antwort.wert.phRequestId,
          detail: geprueft.error.issues.map((i) => i.path.join('.')).join(', '),
        },
      };
    }
    this.token = geprueft.data.access_token;
    const nutzbareMinuten =
      konfiguration.tokenGueltigkeitMin - konfiguration.tokenSicherheitsmargeMin;
    this.gueltigBisMs = uhr.jetztMs() + nutzbareMinuten * MS_JE_MINUTE;
    return { ok: true, wert: this.token };
  }
}
