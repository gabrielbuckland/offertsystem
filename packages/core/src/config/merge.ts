/**
 * Keine Formel. Zwei-Ebenen-Merge (Spec 02 §2.2, §2.3). Gesperrt sind nur
 * `meta` und `api` (siehe `GESPERRTE_PFADE`); alles Uebrige ist projektbezogen
 * ueberschreibbar. Die Invariante wird nicht hier erzwungen, sondern durch die
 * Nachvalidierung im Ladepfad (`konfigurations-lader.ts`).
 */
import { z } from 'zod';
import { fehler, type KonfigurationsFehler } from './fehlercodes.js';
import type { OffertKonfiguration } from './validieren.js';

export interface Preisanpassung {
  readonly faktor: number;
  readonly begruendung: string;
  /** Vorlage, aus der die Anpassung stammt (A-13). `| undefined` noetig wegen exactOptionalPropertyTypes. */
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

/**
 * Projektbezogen nicht ueberschreibbar: `meta` (Schema-/Konfigversion — ein
 * Projekt darf nicht einer anderen Schemaversion folgen) und `api` (Betriebsparameter
 * der IT, Rollentrennung US-08). Alles Uebrige ist ueberschreibbar; die Garantie liegt
 * bei der Nachvalidierung im Ladepfad (`konfigurations-lader.ts`), die eine
 * verletzende Projektkonfiguration zurueckweist.
 */
export const GESPERRTE_PFADE: readonly string[] = ['meta', 'api'];

/** Zweigt in die Sonderbehandlung ab statt in die Basis-Zusammenfuehrung. */
const SONDERPFADE: readonly string[] = ['dossierParameter', 'preisanpassungen'];

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
      // Nur wirksame Ueberschreibungen werden protokolliert.
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
    // Listen werden vollstaendig ersetzt, nie elementweise zusammengefuehrt.
    ergebnis[wohnungsnummer] = geprueft.data;
    protokoll.push({
      pfad: `preisanpassungen.${wohnungsnummer}`,
      defaultwert: [],
      projektwert: geprueft.data,
    });
  }
  return ergebnis;
}

/**
 * Fuehrt einen Ueberschreibungsteilbaum in die Basis ein und protokolliert jedes
 * geaenderte Blatt. Objekte werden feldweise zusammengelegt, Arrays vollstaendig
 * ersetzt — eine elementweise Zusammenfuehrung koennte einen geloeschten
 * Zu-/Abschlag sonst stillschweigend wieder einfuehren. Ein unbekannter Schluessel
 * ist ein Fehler, keine Warnung, sonst verschwaende ein Tippfehler lautlos; offene
 * Woerterbuecher (`aufwandfaktoren`, `dossierDefaults.*bewertungen`) sind ueber
 * `offen` davon ausgenommen.
 */
function verschmelzeTeilbaum(
  basiswert: unknown,
  ueberschreibung: unknown,
  pfad: string,
  befunde: KonfigurationsFehler[],
  protokoll: UeberschreibungsProtokoll[],
  offen: boolean,
): unknown {
  if (Array.isArray(ueberschreibung)) {
    if (JSON.stringify(basiswert) !== JSON.stringify(ueberschreibung)) {
      protokoll.push({ pfad, defaultwert: basiswert, projektwert: ueberschreibung });
    }
    return ueberschreibung;
  }

  if (!istObjekt(ueberschreibung) || !istObjekt(basiswert)) {
    if (basiswert !== ueberschreibung) {
      protokoll.push({ pfad, defaultwert: basiswert, projektwert: ueberschreibung });
    }
    return ueberschreibung;
  }

  const ergebnis: Record<string, unknown> = { ...basiswert };
  for (const [schluessel, wert] of Object.entries(ueberschreibung)) {
    if (!offen && !Object.hasOwn(basiswert, schluessel)) {
      befunde.push(fehler('CFG_SCHEMA_UNKNOWN_KEY', `${pfad}.${schluessel}`, {
        verfuegbar: Object.keys(basiswert).join(', '),
      }));
      continue;
    }
    ergebnis[schluessel] = verschmelzeTeilbaum(
      basiswert[schluessel], wert, `${pfad}.${schluessel}`, befunde, protokoll, false,
    );
  }
  return ergebnis;
}

/** Wurzeln mit frei ergaenzbaren Schluesseln. `aufwandfaktoren` ist der Nachweis fuer FF 1 (A-10). */
const OFFENE_WURZELN: readonly string[] = ['aufwandfaktoren'];

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

  const rohBasis = basis as unknown as Record<string, unknown>;
  const zusammengefuehrt: Record<string, unknown> = { ...rohBasis };

  for (const [schluessel, wert] of Object.entries(ueberschreibungen)) {
    if (SONDERPFADE.includes(schluessel)) continue;
    if (GESPERRTE_PFADE.includes(schluessel)) {
      befunde.push(fehler('CFG_MERGE_LOCKED_PATH', schluessel, {
        bedingung: 'projektbezogen nicht ueberschreibbar; Betriebsparameter der IT',
      }));
      continue;
    }
    if (!Object.hasOwn(rohBasis, schluessel)) {
      befunde.push(fehler('CFG_SCHEMA_UNKNOWN_KEY', schluessel, {
        verfuegbar: [...Object.keys(rohBasis), ...SONDERPFADE].join(', '),
      }));
      continue;
    }
    zusammengefuehrt[schluessel] = verschmelzeTeilbaum(
      rohBasis[schluessel], wert, schluessel, befunde, protokoll,
      OFFENE_WURZELN.includes(schluessel),
    );
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
    wert: {
      basis: zusammengefuehrt as unknown as OffertKonfiguration,
      dossierParameter,
      preisanpassungen,
      ueberschreibungen: protokoll,
    },
  };
}
