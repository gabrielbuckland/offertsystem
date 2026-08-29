/**
 * Keine Formel. HTTP-Client mit Zeitlimit je Versuch, Wiederholung und Gesamtbudget
 * (Spec 04 §6.3, §6.4). Saemtliche Parameter stammen aus `config.api.*`; im Code steht
 * keine Zahlenkonstante fuer Zeitlimit, Backoff oder Versuchszahl (E-13, G-4).
 */
import type { ApiKonfiguration } from '../config/api-konfiguration.js';
import { backoffWartezeitMs } from './backoff.js';
import type { AdapterFehler, AdapterFehlerArt, EndpunktName } from './fehler.js';
import type { Protokoll } from './protokoll.js';
import { bewerteRetryAfter } from './retry-after.js';
import type { Uhr } from './uhr.js';
import type { Zufallsquelle } from './zufall.js';

export interface AnfrageBeschreibung {
  readonly endpunkt: EndpunktName;
  readonly methode: 'GET' | 'POST' | 'PATCH';
  readonly url: string;
  readonly body?: unknown;
  /** aus `config.api.timeoutMs` bzw. `config.api.timeoutValuationMs` (E-13) */
  readonly timeoutMs: number;
  readonly token?: string | undefined;
}

export interface RohAntwort {
  readonly httpStatus: number;
  readonly rumpf: unknown;
  readonly phRequestId?: string | undefined;
}

export type HttpErgebnis =
  | { readonly ok: true; readonly wert: RohAntwort }
  | { readonly ok: false; readonly fehler: AdapterFehler };

export interface HttpClientAbhaengigkeiten {
  readonly konfiguration: ApiKonfiguration;
  readonly uhr: Uhr;
  readonly zufall: Zufallsquelle;
  readonly protokoll: Protokoll;
  readonly fetchImpl: typeof fetch;
}

/** HTTP-Statuscodes mit eigener Behandlung; keine Zeit- oder Backoff-Groessen (G-4). */
const STATUS = {
  erfolgVon: 200,
  erfolgBis: 300,
  nichtAutorisiert: 401,
  verboten: 403,
  nichtGefunden: 404,
  abfragelimit: 429,
  serverfehlerAb: 500,
} as const;

export class HttpClient {
  private readonly abh: HttpClientAbhaengigkeiten;

  // Feldzuweisung statt Parametereigenschaft: `node --experimental-strip-types`
  // (PE-09) uebersetzt nicht, es entfernt nur Typen — Parametereigenschaften
  // haetten eine Codeerzeugung verlangt und sind dort nicht zulaessig.
  public constructor(abh: HttpClientAbhaengigkeiten) {
    this.abh = abh;
  }

  public async fuehreAus(anfrage: AnfrageBeschreibung): Promise<HttpErgebnis> {
    const { konfiguration, uhr, zufall, protokoll, fetchImpl } = this.abh;
    const startMs = uhr.jetztMs();
    let versuch = 0;
    let letzter = this.baue(anfrage, 'NetworkError', 0, 0, 'kein Versuch ausgefuehrt');

    while (versuch < konfiguration.retry.maxVersuche) {
      versuch += 1;
      const abbruch = new AbortController();
      const abbestellen = uhr.plane(anfrage.timeoutMs, () => abbruch.abort());
      let antwort: Response | undefined;
      let transport: 'timeout' | 'netzwerk' | undefined;

      try {
        // `body` wird nur gesetzt, wenn es einen gibt: Unter
        // `exactOptionalPropertyTypes` ist `body: undefined` kein zulaessiges
        // `RequestInit` — weggelassen und explizit leer sind verschiedene Dinge.
        antwort = await fetchImpl(anfrage.url, {
          method: anfrage.methode,
          headers: this.kopfzeilen(anfrage),
          ...(anfrage.body === undefined ? {} : { body: JSON.stringify(anfrage.body) }),
          signal: abbruch.signal,
        });
      } catch {
        transport = abbruch.signal.aborted ? 'timeout' : 'netzwerk';
      } finally {
        abbestellen();
      }

      const dauerMs = uhr.jetztMs() - startMs;
      const phRequestId = antwort?.headers.get('x-ph-request-id') ?? undefined;

      if (transport !== undefined) {
        const art: AdapterFehlerArt = transport === 'timeout' ? 'TimeoutError' : 'NetworkError';
        letzter = this.baue(anfrage, art, versuch, dauerMs, transport, undefined, phRequestId);
        protokoll.versuch({
          ts: new Date(uhr.jetztMs()).toISOString(),
          endpoint: anfrage.endpunkt,
          method: anfrage.methode,
          attempt: versuch,
          elapsedMs: dauerMs,
          outcome: 'wiederholung',
        });
        const gewartet = await this.warteVorNaechstemVersuch(versuch, startMs);
        if (!gewartet) {
          return { ok: false, fehler: this.alsBudgetueberschreitung(letzter) };
        }
        continue;
      }

      const status = antwort!.status;
      protokoll.versuch({
        ts: new Date(uhr.jetztMs()).toISOString(),
        endpoint: anfrage.endpunkt,
        method: anfrage.methode,
        attempt: versuch,
        httpStatus: status,
        elapsedMs: dauerMs,
        phRequestId,
        outcome: status < STATUS.erfolgBis ? 'ok' : 'wiederholung',
      });

      if (status >= STATUS.erfolgVon && status < STATUS.erfolgBis) {
        try {
          const rumpf: unknown = await antwort!.json();
          return { ok: true, wert: { httpStatus: status, rumpf, phRequestId } };
        } catch {
          return {
            ok: false,
            fehler: this.baue(
              anfrage,
              'ContractViolation',
              versuch,
              dauerMs,
              'Antwortrumpf ist kein gueltiges JSON',
              status,
              phRequestId,
            ),
          };
        }
      }

      if (status === STATUS.nichtAutorisiert || status === STATUS.verboten) {
        return {
          ok: false,
          fehler: this.baue(anfrage, 'AuthError', versuch, dauerMs, 'nicht autorisiert', status, phRequestId),
        };
      }
      if (status === STATUS.nichtGefunden) {
        return {
          ok: false,
          fehler: this.baue(anfrage, 'NotFoundError', versuch, dauerMs, 'Ressource unbekannt', status, phRequestId),
        };
      }
      if (status === STATUS.abfragelimit) {
        const entscheid = bewerteRetryAfter(
          antwort!.headers.get('Retry-After'),
          uhr.jetztMs(),
          konfiguration.retry,
        );
        if (entscheid.modus === 'aufgeben') {
          return {
            ok: false,
            fehler: {
              ...this.baue(anfrage, 'RateLimitError', versuch, dauerMs, 'Abfragelimit erreicht', status, phRequestId),
              wiederholbarNachSek: entscheid.wiederholbarNachSek,
            },
          };
        }
        letzter = this.baue(anfrage, 'RateLimitError', versuch, dauerMs, 'Abfragelimit erreicht', status, phRequestId);
        const wartezeitMs =
          entscheid.modus === 'warten'
            ? entscheid.wartezeitMs
            : backoffWartezeitMs(versuch, konfiguration.retry, zufall);
        if (!(await this.warteGenau(wartezeitMs, startMs))) {
          return { ok: false, fehler: this.alsBudgetueberschreitung(letzter) };
        }
        continue;
      }
      if (status >= STATUS.serverfehlerAb || konfiguration.retry.retryStatuscodes.includes(status)) {
        letzter = this.baue(anfrage, 'ServerError', versuch, dauerMs, `Statuscode ${status}`, status, phRequestId);
        if (!(await this.warteVorNaechstemVersuch(versuch, startMs))) {
          return { ok: false, fehler: this.alsBudgetueberschreitung(letzter) };
        }
        continue;
      }

      // uebrige 4xx: deterministisch, kein Retry (Spec 04 §6.1)
      const feld = await this.beanstandetesFeld(antwort!);
      return {
        ok: false,
        fehler: {
          ...this.baue(anfrage, 'ClientError', versuch, dauerMs, `Statuscode ${status}`, status, phRequestId),
          feld,
        },
      };
    }

    return { ok: false, fehler: { ...letzter, versuche: konfiguration.retry.maxVersuche } };
  }

  private kopfzeilen(anfrage: AnfrageBeschreibung): Record<string, string> {
    const basis: Record<string, string> = { 'Content-Type': 'application/json' };
    if (anfrage.token !== undefined) {
      basis['Authorization'] = `Bearer ${anfrage.token}`;
    }
    return basis;
  }

  private async beanstandetesFeld(antwort: Response): Promise<string | undefined> {
    try {
      const rumpf = (await antwort.json()) as { field?: unknown };
      return typeof rumpf.field === 'string' ? rumpf.field : undefined;
    } catch {
      return undefined;
    }
  }

  private async warteVorNaechstemVersuch(versuch: number, startMs: number): Promise<boolean> {
    const { konfiguration, zufall } = this.abh;
    if (versuch >= konfiguration.retry.maxVersuche) {
      return true;
    }
    return this.warteGenau(backoffWartezeitMs(versuch, konfiguration.retry, zufall), startMs);
  }

  private async warteGenau(wartezeitMs: number, startMs: number): Promise<boolean> {
    const { konfiguration, uhr } = this.abh;
    if (uhr.jetztMs() - startMs + wartezeitMs > konfiguration.gesamtbudgetMs) {
      return false;
    }
    await uhr.warte(wartezeitMs);
    return true;
  }

  private alsBudgetueberschreitung(fehler: AdapterFehler): AdapterFehler {
    return { ...fehler, art: 'TimeoutError', detail: 'api.gesamtbudgetMs ueberschritten' };
  }

  private baue(
    anfrage: AnfrageBeschreibung,
    art: AdapterFehlerArt,
    versuche: number,
    dauerMs: number,
    detail: string,
    httpStatus?: number,
    phRequestId?: string,
  ): AdapterFehler {
    return { art, endpunkt: anfrage.endpunkt, versuche, dauerMs, detail, httpStatus, phRequestId };
  }
}
