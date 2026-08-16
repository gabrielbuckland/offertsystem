/**
 * Keine eigene Formel. Ablauf je Offerte (Spec 04 §3.1), Abrufzahl `N = 2 + 2*T`
 * (I-27, NFA-12):
 *
 *   0. (bedingt) E1 Login — nur ohne gueltigen Token
 *   1. E2 Get Dossier      — 1x, Ausgangszustand feststellen
 *   2. E5 Location Scores  — 1x, ueber `holeLagescores`
 *   3. je Wohnungstyp streng sequenziell: E3 PATCH -> E4 POST -> isValuationStale pruefen
 *
 * Schritt 3 ist zwingend sequenziell: Das Dossier haelt zu jedem Zeitpunkt GENAU EINE
 * Parametrisierung und ist kein Container fuer mehrere Wohneinheiten. Nach dem PATCH
 * fuer Typ t+1 ist die Bewertung des Typs t serverseitig nicht mehr abrufbar.
 *
 * Einschraenkung R-01: Der Prototyp arbeitet gegen ein fixes Test-Dossier; dessen
 * Adresse ist unveraenderlich. Die erfasste Projektadresse wirkt daher ausschliesslich
 * auf E5, nicht auf die Bewertung.
 */
import type {
  Adresse,
  BewertungsAnfrage,
  BewertungsBuendel,
  Lagescores,
  ProviderFehler,
  Referenzbewertung,
  Result,
  ValuationProvider,
  WohnungstypId,
} from '@offert/core';
import { aufLagescores } from '../acl/lagescoreMapper.js';
import { aufReferenzbewertung, dossierBody } from '../acl/bewertungMapper.js';
import { uebersetzeFehler } from '../acl/fehlerUebersetzung.js';
import { verifiziereGesendetePatchFelder } from '../acl/patchVerifikation.js';
import type { ApiKonfiguration } from '../config/apiKonfiguration.js';
import type { AdapterFehler, EndpunktName } from '../client/fehler.js';
import type { HttpClient, RohAntwort } from '../client/httpClient.js';
import type { Protokoll } from '../client/protokoll.js';
import type { TokenVerwaltung } from '../client/tokenVerwaltung.js';
import type { Uhr } from '../client/uhr.js';
import type { Warteschlange } from '../client/warteschlange.js';
import { DossierResponseSchema } from '../schema/dossierResponse.js';
import { LocationScoresResponseSchema } from '../schema/locationScoresResponse.js';
import { ValuationResponseSchema, type ValuationResponse } from '../schema/valuationResponse.js';

export interface AdapterAbhaengigkeiten {
  readonly konfiguration: ApiKonfiguration;
  readonly dossierId: string;
  readonly client: HttpClient;
  readonly tokenVerwaltung: TokenVerwaltung;
  readonly uhr: Uhr;
  readonly protokoll: Protokoll;
  readonly warteschlange: Warteschlange;
}

type Zwischenergebnis<T> =
  | { readonly ok: true; readonly wert: T }
  | { readonly ok: false; readonly fehler: AdapterFehler };

/** Genau ein Wiederholungsversuch der Bewertung bei `isValuationStale` (Spec 04 §3.3). */
const BEWERTUNGSVERSUCHE = 2;

export class PriceHubbleAdapter implements ValuationProvider {
  private readonly abh: AdapterAbhaengigkeiten;

  // Feldzuweisung statt Parametereigenschaft: `node --experimental-strip-types`
  // (PE-09) uebersetzt nicht, es entfernt nur Typen — Parametereigenschaften
  // haetten eine Codeerzeugung verlangt und sind dort nicht zulaessig.
  public constructor(abh: AdapterAbhaengigkeiten) {
    this.abh = abh;
  }

  public async holeLagescores(adresse: Adresse): Promise<Result<Lagescores, ProviderFehler>> {
    const { konfiguration, dossierId, uhr } = this.abh;
    const antwort = await this.abh.tokenVerwaltung.mitToken((token) => ({
      endpunkt: 'locationScores',
      methode: 'POST',
      url: `${konfiguration.baseUrl}${konfiguration.endpunkte.locationScores}`,
      timeoutMs: konfiguration.timeoutMs,
      token,
      body: {
        location: {
          address: {
            postCode: adresse.plz,
            city: adresse.ort,
            street: adresse.strasse,
            houseNumber: adresse.hausnummer,
          },
        },
        countryCode: 'CH',
        dossierId,
      },
    }));
    if (!antwort.ok) {
      return { ok: false, fehler: uebersetzeFehler(antwort.fehler) };
    }
    const geprueft = this.pruefe(LocationScoresResponseSchema, antwort.wert, 'locationScores');
    if (!geprueft.ok) {
      return { ok: false, fehler: uebersetzeFehler(geprueft.fehler) };
    }
    const abrufdatum = new Date(uhr.jetztMs()).toISOString().slice(0, 10);
    return { ok: true, wert: aufLagescores(geprueft.wert, abrufdatum) };
  }

  public async bewerteWohnungstypen(
    anfragen: readonly BewertungsAnfrage[],
  ): Promise<Result<BewertungsBuendel, ProviderFehler>> {
    return this.abh.warteschlange.reiheEin(this.abh.dossierId, async () =>
      this.durchlauf(anfragen),
    );
  }

  private async durchlauf(
    anfragen: readonly BewertungsAnfrage[],
  ): Promise<Result<BewertungsBuendel, ProviderFehler>> {
    const bewertungen = new Map<WohnungstypId, Referenzbewertung>();

    const ausgangszustand = await this.holeDossier();
    if (!ausgangszustand.ok) {
      return { ok: false, fehler: uebersetzeFehler(ausgangszustand.fehler) };
    }

    for (const anfrage of anfragen) {
      const bewertung = await this.bewerteEinenTyp(anfrage);
      if (!bewertung.ok) {
        return this.teilergebnis(bewertungen, anfrage.wohnungstypId, bewertung.fehler);
      }
      bewertungen.set(anfrage.wohnungstypId, bewertung.wert);
    }

    return { ok: true, wert: { vollstaendig: true, bewertungen } };
  }

  private async bewerteEinenTyp(
    anfrage: BewertungsAnfrage,
  ): Promise<Zwischenergebnis<Referenzbewertung>> {
    const { konfiguration, dossierId } = this.abh;
    const gesendet = dossierBody(anfrage.parametrisierung);

    // 3a. E3 PATCH — repraesentative Parametrisierung des Typs setzen
    const patch = await this.abh.tokenVerwaltung.mitToken((token) => ({
      endpunkt: 'dossierUpdate' as EndpunktName,
      methode: 'PATCH' as const,
      url: this.url(konfiguration.endpunkte.dossierUpdate, dossierId),
      timeoutMs: konfiguration.timeoutMs,
      token,
      body: gesendet,
    }));
    if (!patch.ok) {
      return { ok: false, fehler: patch.fehler };
    }
    const abweichungen = verifiziereGesendetePatchFelder(gesendet, patch.wert.rumpf);
    if (abweichungen.length > 0) {
      this.abh.protokoll.vertragsbruch({
        ts: new Date(this.abh.uhr.jetztMs()).toISOString(),
        endpoint: 'dossierUpdate',
        pfad: abweichungen.join(', '),
        erwarteterTyp: 'gesendeter Wert',
      });
      return {
        ok: false,
        fehler: {
          art: 'ContractViolation',
          endpunkt: 'dossierUpdate',
          versuche: 1,
          dauerMs: 0,
          httpStatus: patch.wert.httpStatus,
          phRequestId: patch.wert.phRequestId,
          detail: `PATCH-Verifikation fehlgeschlagen: ${abweichungen.join(', ')}`,
        },
      };
    }

    // 3b./3c. E4 POST und Pruefung von isValuationStale, mit genau einer Wiederholung
    for (let versuch = 1; versuch <= BEWERTUNGSVERSUCHE; versuch += 1) {
      const bewertet = await this.rechneNeu();
      if (!bewertet.ok) {
        return { ok: false, fehler: bewertet.fehler };
      }
      if (!bewertet.wert.isValuationStale) {
        return {
          ok: true,
          wert: aufReferenzbewertung({
            wohnungstypId: anfrage.wohnungstypId,
            antwort: bewertet.wert,
            parametrisierungsAbdruck: anfrage.parametrisierung,
          }),
        };
      }
    }

    // Es wird NIE ein als veraltet markierter Wert uebernommen (Spec 04 §3.3 Punkt 6).
    return {
      ok: false,
      fehler: {
        art: 'StaleValuationError',
        endpunkt: 'dossierValuation',
        versuche: BEWERTUNGSVERSUCHE,
        dauerMs: 0,
        detail: 'isValuationStale blieb nach der Wiederholung true',
        grundcode: 'stale_valuation',
      },
    };
  }

  private async holeDossier(): Promise<Zwischenergebnis<unknown>> {
    const { konfiguration, dossierId } = this.abh;
    const antwort = await this.abh.tokenVerwaltung.mitToken((token) => ({
      endpunkt: 'dossierGet' as EndpunktName,
      methode: 'GET' as const,
      url: this.url(konfiguration.endpunkte.dossierGet, dossierId),
      timeoutMs: konfiguration.timeoutMs,
      token,
    }));
    if (!antwort.ok) {
      return { ok: false, fehler: antwort.fehler };
    }
    return this.pruefe(DossierResponseSchema, antwort.wert, 'dossierGet');
  }

  private async rechneNeu(): Promise<Zwischenergebnis<ValuationResponse>> {
    const { konfiguration, dossierId } = this.abh;
    const antwort = await this.abh.tokenVerwaltung.mitToken((token) => ({
      endpunkt: 'dossierValuation' as EndpunktName,
      methode: 'POST' as const,
      url: this.url(konfiguration.endpunkte.dossierValuation, dossierId),
      // E4 stoesst eine Neuberechnung an und erhaelt ein eigenes, hoeheres Zeitlimit.
      timeoutMs: konfiguration.timeoutValuationMs,
      token,
      body: {},
    }));
    if (!antwort.ok) {
      return { ok: false, fehler: antwort.fehler };
    }
    return this.pruefe(ValuationResponseSchema, antwort.wert, 'dossierValuation');
  }

  private url(schablone: string, dossierId: string): string {
    return `${this.abh.konfiguration.baseUrl}${schablone.replace('{dossierId}', dossierId)}`;
  }

  /**
   * Laufzeitvalidierung JEDER Antwort, bevor die Daten den ACL verlassen (Spec 04 §5.1,
   * I-02). Protokolliert wird der Zod-Pfad und der erwartete Typ — nicht der beobachtete
   * Wert, der Objektdaten enthalten koennte (§6.7).
   */
  private pruefe<T>(
    schema: {
      safeParse(daten: unknown):
        | { success: true; data: T }
        | { success: false; error: { issues: { path: (string | number)[]; expected?: unknown }[] } };
    },
    antwort: RohAntwort,
    endpunkt: EndpunktName,
  ): Zwischenergebnis<T> {
    const ergebnis = schema.safeParse(antwort.rumpf);
    if (ergebnis.success) {
      return { ok: true, wert: ergebnis.data };
    }
    const pfad = ergebnis.error.issues.map((i) => i.path.join('.')).join(', ');
    this.abh.protokoll.vertragsbruch({
      ts: new Date(this.abh.uhr.jetztMs()).toISOString(),
      endpoint: endpunkt,
      pfad,
      erwarteterTyp: String(ergebnis.error.issues[0]?.expected ?? 'siehe Schema'),
    });
    return {
      ok: false,
      fehler: {
        art: 'ContractViolation',
        endpunkt,
        versuche: 1,
        dauerMs: 0,
        httpStatus: antwort.httpStatus,
        phRequestId: antwort.phRequestId,
        detail: pfad,
      },
    };
  }

  private teilergebnis(
    bewertungen: ReadonlyMap<WohnungstypId, Referenzbewertung>,
    fehlgeschlagenerTyp: WohnungstypId,
    fehler: AdapterFehler,
  ): Result<BewertungsBuendel, ProviderFehler> {
    this.abh.protokoll.abbruch({
      ts: new Date(this.abh.uhr.jetztMs()).toISOString(),
      vollstaendig: false,
      bezogeneTypen: bewertungen.size,
      fehlerart: fehler.art,
    });
    return {
      ok: true,
      wert: {
        vollstaendig: false,
        bewertungen,
        fehlgeschlagenerTyp,
        fehler: uebersetzeFehler(fehler),
      },
    };
  }
}
