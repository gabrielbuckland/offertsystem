// Mock-Ebene 1 (Interface). Kein HTTP, keine Schemavalidierung.
import type {
  BewertungsAnfrage, BewertungsBuendel, Lagescores, ProviderFehler,
  Referenzbewertung, ValuationProvider,
} from '../../src/ports/valuation-provider.js';
import type { Adresse } from '../../src/domain/adresse.js';
import { fehlschlag, ok, type Result } from '../../src/domain/result.js';
import type { WohnungstypId } from '../../src/domain/ids.js';
import { lagescoresFixture } from './projekt.js';

interface MockOptionen {
  readonly bewertungen?: readonly Referenzbewertung[];
  readonly lagescores?: Lagescores;
  readonly fehler?: ProviderFehler;
  readonly abbruchNachTyp?: WohnungstypId;
}

export class TestValuationProvider implements ValuationProvider {
  readonly aufrufe = { bewerteWohnungstypen: 0, holeLagescores: 0 };
  constructor(private readonly optionen: MockOptionen = {}) {}

  async bewerteWohnungstypen(
    _anfragen: readonly BewertungsAnfrage[],
  ): Promise<Result<BewertungsBuendel, ProviderFehler>> {
    this.aufrufe.bewerteWohnungstypen += 1;
    if (this.optionen.fehler !== undefined) return fehlschlag(this.optionen.fehler);
    const bewertungen = new Map((this.optionen.bewertungen ?? []).map((b) => [b.wohnungstypId, b]));
    if (this.optionen.abbruchNachTyp !== undefined) {
      return ok({
        vollstaendig: false,
        bewertungen,
        fehlgeschlagenerTyp: this.optionen.abbruchNachTyp,
        fehler: { art: 'zeitueberschreitung', detail: 'Bewertungsabruf abgebrochen',
          diagnose: { endpoint: 'dossierValuation', versuche: 3, dauerMs: 20_000 } },
      });
    }
    return ok({ vollstaendig: true, bewertungen });
  }

  async holeLagescores(_adresse: Adresse): Promise<Result<Lagescores, ProviderFehler>> {
    this.aufrufe.holeLagescores += 1;
    if (this.optionen.fehler !== undefined) return fehlschlag(this.optionen.fehler);
    return ok(this.optionen.lagescores ?? lagescoresFixture());
  }
}
