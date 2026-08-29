/**
 * Keine Formel. Mock-Ebene A (Brief §5.6): Der Port wird ersetzt.
 *
 * Damit laeuft die Pipeline OHNE Netzwerk und OHNE Zugangsdaten vollstaendig durch —
 * Entkopplungskriterium (a) aus 6.4.
 *
 * Der Mock liegt oberhalb der Schemavalidierung und kann sie konstruktionsbedingt nicht
 * pruefen; Szenario 2 und 3 sind auf dieser Ebene NICHT nachweisbar (Spec 04 §7.3).
 */
import type {
  Adresse,
  BewertungsAnfrage,
  BewertungsBuendel,
  Lagescores,
  LagescoreName,
  ProviderFehler,
  Rappen,
  Referenzbewertung,
  Result,
  Score,
  ValuationProvider,
  WohnungstypId,
} from '@offert/core';

export interface MockEinstellungen {
  /** Ab diesem Wohnungstyp liefert der Mock ein gekennzeichnetes Teilergebnis (US-15). */
  readonly scheiternAbTyp?: WohnungstypId;
  /** Erzeugt einen Portfehler beim Lagescore-Abruf. */
  readonly lagescoreFehler?: ProviderFehler['art'];
}

const MOCK_SCORES: ReadonlyArray<readonly [string, number]> = [
  ['location', 0.82],
  ['family', 0.74],
  ['health', 0.68],
  ['leisure', 0.71],
  ['shopping', 0.9],
  ['catering', 0.86],
  ['view', 0.55],
  ['noise', 0.62],
  ['nuisance', 0.79],
];

/** Rappen je Quadratmeter der Mock-Bewertung; reine Testgroesse, kein Modellparameter. */
const MOCK_RAPPEN_JE_QM = 1_200_000;

export class MockValuationProvider implements ValuationProvider {
  private readonly einstellungen: MockEinstellungen;

  // Feldzuweisung statt Parametereigenschaft: `node --experimental-strip-types`
  // (PE-09) uebersetzt nicht, es entfernt nur Typen — Parametereigenschaften
  // haetten eine Codeerzeugung verlangt und sind dort nicht zulaessig.
  public constructor(einstellungen: MockEinstellungen = {}) {
    this.einstellungen = einstellungen;
  }

  public async bewerteWohnungstypen(
    anfragen: readonly BewertungsAnfrage[],
  ): Promise<Result<BewertungsBuendel, ProviderFehler>> {
    const bewertungen = new Map<WohnungstypId, Referenzbewertung>();
    for (const anfrage of anfragen) {
      if (anfrage.wohnungstypId === this.einstellungen.scheiternAbTyp) {
        return {
          ok: true,
          wert: {
            vollstaendig: false,
            bewertungen,
            fehlgeschlagenerTyp: anfrage.wohnungstypId,
            fehler: {
              art: 'zeitueberschreitung',
              detail: 'PriceHubble hat nicht rechtzeitig geantwortet.',
              diagnose: {
                endpoint: 'dossierValuation',
                versuche: 3,
                dauerMs: 1500,
              },
            },
          },
        };
      }
      bewertungen.set(anfrage.wohnungstypId, this.bewertung(anfrage));
    }
    return { ok: true, wert: { vollstaendig: true, bewertungen } };
  }

  public async holeLagescores(_adresse: Adresse): Promise<Result<Lagescores, ProviderFehler>> {
    const art = this.einstellungen.lagescoreFehler;
    if (art !== undefined) {
      return {
        ok: false,
        fehler: {
          art,
          detail: 'Mock-Fehler',
          diagnose: { endpoint: 'locationScores', versuche: 1, dauerMs: 10 },
        } as ProviderFehler,
      };
    }
    const werte = new Map<LagescoreName, Score>();
    const meta = new Map<LagescoreName, { originalScore: Score; isOverridden: boolean }>();
    for (const [name, wert] of MOCK_SCORES) {
      const schluessel = name as unknown as LagescoreName;
      werte.set(schluessel, wert as Score);
      meta.set(schluessel, { originalScore: wert as Score, isOverridden: false });
    }
    return { ok: true, wert: { werte, meta, abrufdatum: '2026-08-16', anbieter: 'mock' } };
  }

  /** Deterministisch aus der Innenflaeche abgeleitet — identische Eingabe, identisches Ergebnis (I-14). */
  private bewertung(anfrage: BewertungsAnfrage): Referenzbewertung {
    const marktwertRappen = Math.trunc(anfrage.parametrisierung.flaecheInnen * MOCK_RAPPEN_JE_QM);
    return {
      wohnungstypId: anfrage.wohnungstypId,
      marktwert: marktwertRappen as Rappen,
      bewertungsdatum: '2026-08-16',
      anbieter: 'mock',
      parametrisierungsAbdruck: anfrage.parametrisierung,
      anzeige: {
        konfidenzbereich: {
          von: Math.trunc(marktwertRappen * 0.92) as Rappen,
          bis: Math.trunc(marktwertRappen * 1.11) as Rappen,
        },
        konfidenzklasse: 'good',
        konfidenzwert: 0.19,
      },
    };
  }
}
