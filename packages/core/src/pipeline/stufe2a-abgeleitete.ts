// Keine eigene Formel (E-32); liest Ergebnisgroessen aus eq:qm_preis und eq:flaeche.
// Der Schritt ist bewusst KEINE sechste Stufe (NFA-03), sondern Eingabeaufbereitung:
// er stellt einen Rohwert bereit, den Stufe 1 nur deshalb nicht liefern konnte, weil
// seine Quelle erst in Stufe 2 entsteht (E-06).
import type { FaktorId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import type { StufenFehler } from '../fehler/stufenfehler.js';
import type { AbleitungsName } from '../config/typen.js';
import { sortiereNachSchluessel } from '../util/sortierung.js';
import { beschafferFuer, type BeschaffungsKontext } from './beschaffer.js';
import type { PipelineEingang } from './stufe1-eingabe.js';
import type { VerkaufssummeErgebnis } from './stufe2-verkaufssumme.js';

/** Eingang mit vollstaendig beschafften Rohwerten; einzige zulaessige Eingabe von Stufe 3. */
export interface GeschlossenerEingang extends PipelineEingang {
  readonly offeneFaktoren: readonly [];
}

/**
 * Kennzahlen der Quelle `abgeleitet`.
 * - `einheitenzahl`: m aus eq:verkaufssumme.
 * - `mittlererQuadratmeterpreis`: q-quer = (Summe_j q_t(j) * A_j) / (Summe_j A_j) in
 *   Rappen/m^2, gebildet VOR den Zu-/Abschlaegen (Spec 02 §5.3, E-07).
 */
function bildeAbleitungen(verkauf: VerkaufssummeErgebnis): ReadonlyMap<AbleitungsName, number> {
  const flaechensumme = verkauf.positionen.reduce((s, p) => s + p.gewichteteFlaeche, 0);
  const basissumme = verkauf.positionen.reduce((s, p) => s + p.basispreis, 0);
  const ableitungen = new Map<AbleitungsName, number>([
    ['einheitenzahl', verkauf.einheitenzahl],
  ]);
  if (flaechensumme > 0) {
    ableitungen.set('mittlererQuadratmeterpreis', basissumme / flaechensumme);
  }
  return ableitungen;
}

export function ergaenzeAbgeleiteteFaktoren(
  eingang: PipelineEingang,
  verkauf: VerkaufssummeErgebnis,
): Result<GeschlossenerEingang, StufenFehler> {
  if (eingang.offeneFaktoren.length === 0) {
    return ok({ ...eingang, offeneFaktoren: [] as const });
  }

  const kontext: BeschaffungsKontext = {
    lagescores: { werte: new Map(), meta: new Map(), abrufdatum: '', anbieter: '' },
    vermarkterFaktoren: { werte: new Map() },
    ableitungen: bildeAbleitungen(verkauf),
  };

  const rohfaktoren = new Map<FaktorId, number>(eingang.rohfaktoren);
  const offen = new Set<FaktorId>(eingang.offeneFaktoren);
  for (const [id, parameter] of sortiereNachSchluessel(eingang.konfiguration.faktoren)) {
    if (!offen.has(id)) continue;
    const wert = beschafferFuer(parameter.quelle).beschaffe(
      parameter.quellSchluessel, kontext, parameter, id, 3,
    );
    if (!wert.ok) return fehlschlag(wert.fehler);
    if (wert.wert === 'spaeter') {
      throw new Error(`Beschaffer der Quelle ${parameter.quelle} vertagt zweimal — Defekt`);
    }
    rohfaktoren.set(id, wert.wert);
  }

  // Erneut aufsteigend sortiert einsetzen, damit die Einfuegereihenfolge der Map
  // ergebnisunabhaengig bleibt (Spec 03 §9.3).
  const sortiert = new Map(
    [...rohfaktoren.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return ok({ ...eingang, rohfaktoren: sortiert, offeneFaktoren: [] as const });
}
