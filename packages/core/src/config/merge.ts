/**
 * Keine Formel. Zwei-Ebenen-Merge (Spec 02 §2.2, §2.3).
 * Ebene 1 ist die firmenweite Berechnungsbasis, Ebene 2 ein Teilbaum des
 * Projektdatensatzes — keine zweite Konfigurationsdatei. Ueberschreibbar sind
 * ausschliesslich die Dossier-Parameter je Wohnungstyp und die Zu-/Abschlaege
 * je Einheit; alles Uebrige ist gesperrt.
 *
 * Der Merge kann Ebene 3 nicht verletzen, weil keine invariantenrelevante
 * Groesse ueberschreibbar ist. Die erneute Validierung im Ladepfad ist dennoch
 * vorgesehen, damit die Aussage nicht von der Vollstaendigkeit der Sperrliste
 * abhaengt.
 */
import { z } from 'zod';
import { fehler, type KonfigurationsFehler } from './fehlercodes.js';
import type { OffertKonfiguration } from './validieren.js';

export interface Preisanpassung {
  readonly faktor: number;
  readonly begruendung: string;
  /**
   * Verweist auf die Vorlage, aus der die Anpassung instanziiert wurde. Damit
   * bleibt in der Offerte erkennbar, ob eine Anpassung aus der Vorlage stammt,
   * gegenueber der Vorlage veraendert wurde oder frei erfasst ist (A-13).
   * `| undefined` ist bei exactOptionalPropertyTypes noetig, weil Zod die
   * optionale Eigenschaft genau so ableitet.
   */
  readonly vorlageId?: string | undefined;
}

export interface UeberschreibungsProtokoll {
  readonly pfad: string;
  readonly defaultwert: unknown;
  readonly projektwert: unknown;
}

export type DossierParameter = OffertKonfiguration['dossierDefaults'];

export interface EffektiveKonfiguration {
  readonly basis: OffertKonfiguration;
  readonly dossierParameter: Readonly<Record<string, DossierParameter>>;
  readonly preisanpassungen: Readonly<Record<string, readonly Preisanpassung[]>>;
  readonly ueberschreibungen: readonly UeberschreibungsProtokoll[];
}

export type MergeErgebnis =
  | { readonly ok: true; readonly wert: EffektiveKonfiguration }
  | { readonly ok: false; readonly fehler: readonly KonfigurationsFehler[] };

/** Nicht projektbezogen ueberschreibbar (Spec 02 §2.3). */
export const GESPERRTE_PFADE: readonly string[] = [
  'meta', 'flaeche', 'preisanpassung', 'anpassungsVorlagen',
  'aufwandfaktoren', 'honorar', 'dossierDefaults', 'api',
];

const ERLAUBTE_PFADE: readonly string[] = ['dossierParameter', 'preisanpassungen'];

const PreisanpassungSchema = z.object({
  faktor: z.number(),
  begruendung: z.string(),
  vorlageId: z.string().optional(),
}).strict();

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

function verschmelzeDossierParameter(
  basis: OffertKonfiguration,
  roh: unknown,
  befunde: KonfigurationsFehler[],
  protokoll: UeberschreibungsProtokoll[],
): Record<string, DossierParameter> {
  const ergebnis: Record<string, DossierParameter> = {};
  if (roh === undefined) return ergebnis;
  if (!istObjekt(roh)) {
    befunde.push(fehler('CFG_SCHEMA_TYPE', 'dossierParameter', {
      erwartet: 'object', erhalten: typeof roh,
    }));
    return ergebnis;
  }

  const defaults = basis.dossierDefaults as unknown as Record<string, unknown>;

  for (const [wohnungstyp, rohParameter] of Object.entries(roh)) {
    if (!istObjekt(rohParameter)) {
      befunde.push(fehler('CFG_SCHEMA_TYPE', `dossierParameter.${wohnungstyp}`, {
        erwartet: 'object', erhalten: typeof rohParameter,
      }));
      continue;
    }
    const zusammengesetzt: Record<string, unknown> = { ...defaults };
    for (const [schluessel, projektwert] of Object.entries(rohParameter)) {
      if (!Object.hasOwn(defaults, schluessel)) {
        befunde.push(fehler('CFG_SCHEMA_UNKNOWN_KEY', `dossierParameter.${wohnungstyp}.${schluessel}`, {
          verfuegbar: Object.keys(defaults).join(', '),
        }));
        continue;
      }
      const defaultwert = defaults[schluessel];
      zusammengesetzt[schluessel] = projektwert;
      // Nur wirksame Ueberschreibungen werden protokolliert; ein ausdrueckliches
      // null auf einen bereits nicht gesetzten Wert veraendert nichts.
      if (projektwert !== defaultwert) {
        protokoll.push({
          pfad: `dossierParameter.${wohnungstyp}.${schluessel}`,
          defaultwert,
          projektwert,
        });
      }
    }
    ergebnis[wohnungstyp] = zusammengesetzt as unknown as DossierParameter;
  }
  return ergebnis;
}

function verschmelzePreisanpassungen(
  roh: unknown,
  befunde: KonfigurationsFehler[],
  protokoll: UeberschreibungsProtokoll[],
): Record<string, readonly Preisanpassung[]> {
  const ergebnis: Record<string, readonly Preisanpassung[]> = {};
  if (roh === undefined) return ergebnis;
  if (!istObjekt(roh)) {
    befunde.push(fehler('CFG_SCHEMA_TYPE', 'preisanpassungen', {
      erwartet: 'object', erhalten: typeof roh,
    }));
    return ergebnis;
  }

  for (const [wohnungsnummer, rohListe] of Object.entries(roh)) {
    const geprueft = z.array(PreisanpassungSchema).safeParse(rohListe);
    if (!geprueft.success) {
      for (const issue of geprueft.error.issues) {
        const pfad = `preisanpassungen.${wohnungsnummer}${issue.path.map((t) =>
          typeof t === 'number' ? `[${t}]` : `.${t}`).join('')}`;
        const code = issue.code === z.ZodIssueCode.unrecognized_keys
          ? 'CFG_SCHEMA_UNKNOWN_KEY'
          : issue.code === z.ZodIssueCode.invalid_type && issue.received === 'undefined'
            ? 'CFG_SCHEMA_MISSING'
            : 'CFG_SCHEMA_TYPE';
        befunde.push(fehler(code, pfad, { hinweis: issue.message }));
      }
      continue;
    }
    // Listen werden immer vollstaendig ersetzt, nie elementweise zusammengefuehrt.
    ergebnis[wohnungsnummer] = geprueft.data;
    protokoll.push({
      pfad: `preisanpassungen.${wohnungsnummer}`,
      defaultwert: [],
      projektwert: geprueft.data,
    });
  }
  return ergebnis;
}

export function mergeKonfiguration(
  basis: OffertKonfiguration,
  ueberschreibungen: unknown,
): MergeErgebnis {
  const befunde: KonfigurationsFehler[] = [];
  const protokoll: UeberschreibungsProtokoll[] = [];

  if (ueberschreibungen === undefined || ueberschreibungen === null) {
    return {
      ok: true,
      wert: { basis, dossierParameter: {}, preisanpassungen: {}, ueberschreibungen: [] },
    };
  }
  if (!istObjekt(ueberschreibungen)) {
    return {
      ok: false,
      fehler: [fehler('CFG_SCHEMA_TYPE', 'overrides', {
        erwartet: 'object', erhalten: typeof ueberschreibungen,
      })],
    };
  }

  for (const schluessel of Object.keys(ueberschreibungen)) {
    if (ERLAUBTE_PFADE.includes(schluessel)) continue;
    if (GESPERRTE_PFADE.includes(schluessel)) {
      befunde.push(fehler('CFG_MERGE_LOCKED_PATH', schluessel, {
        bedingung: 'projektbezogen nicht ueberschreibbar; die firmenweite Basis bleibt unverschoben',
      }));
    } else {
      befunde.push(fehler('CFG_SCHEMA_UNKNOWN_KEY', schluessel, {
        verfuegbar: ERLAUBTE_PFADE.join(', '),
      }));
    }
  }

  const dossierParameter = verschmelzeDossierParameter(
    basis, ueberschreibungen['dossierParameter'], befunde, protokoll,
  );
  const preisanpassungen = verschmelzePreisanpassungen(
    ueberschreibungen['preisanpassungen'], befunde, protokoll,
  );

  if (befunde.length > 0) return { ok: false, fehler: befunde };
  return {
    ok: true,
    wert: { basis, dossierParameter, preisanpassungen, ueberschreibungen: protokoll },
  };
}
