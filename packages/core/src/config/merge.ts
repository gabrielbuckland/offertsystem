/**
 * Keine Formel. Zwei-Ebenen-Merge (Spec 02 §2.2, §2.3).
 * Ebene 1 ist die firmenweite Berechnungsbasis, Ebene 2 ein Teilbaum des
 * Projektdatensatzes — keine zweite Konfigurationsdatei. Gesperrt sind seit
 * 2026-08-29 nur noch `meta` und `api` (siehe `GESPERRTE_PFADE`); alles
 * Uebrige ist projektbezogen ueberschreibbar.
 *
 * Der Merge kann Ebene 3 dadurch nicht mehr konstruktionsbedingt ausschliessen.
 * Die Garantie traegt stattdessen die erneute Validierung im Ladepfad
 * (`konfigurations-lader.ts`), die die zusammengefuehrte Basis erneut durch
 * alle drei Pruefebenen schickt.
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

/**
 * Nicht projektbezogen ueberschreibbar. Seit der Auftraggeber-Rueckmeldung vom
 * 2026-08-29 sind das nur noch zwei Pfade: `meta` traegt Schema- und Konfigversion
 * (ein Projekt darf nicht behaupten, einer anderen Schemaversion zu folgen), `api`
 * traegt Betriebsparameter der Zugriffsschicht und gehoert der IT, nicht dem
 * Auftraggeber (Rollentrennung US-08).
 *
 * ALLES UEBRIGE IST UEBERSTEUERBAR. Damit faellt das fruehere Argument weg, eine
 * projektbezogene Anpassung koenne konstruktionsbedingt keine Invariante verletzen.
 * Die Garantie liegt jetzt bei der Nachvalidierung im Ladepfad
 * (`konfigurations-lader.ts`), die die zusammengefuehrte Basis erneut durch alle drei
 * Pruefebenen schickt und eine verletzende Projektkonfiguration ZURUECKWEIST. Diese
 * Nachvalidierung ist damit tragend und darf nicht uebersprungen werden.
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

/**
 * Fuehrt einen Ueberschreibungsteilbaum in die Basis ein und protokolliert jedes
 * geaenderte Blatt mit seinem vollqualifizierten Punktpfad.
 *
 * Objekte werden feldweise zusammengelegt, ARRAYS VOLLSTAENDIG ERSETZT. Die
 * Array-Regel ist die bestehende und bleibt begruendet: Eine elementweise
 * Zusammenfuehrung koennte einen projektbezogen geloeschten Zu-/Abschlag
 * stillschweigend wieder einfuehren.
 *
 * Ein unbekannter Schluessel ist ein Fehler, keine Warnung — sonst verschwaende ein
 * Tippfehler die Uebersteuerung lautlos. Geprueft wird gegen die Schluesselmenge der
 * Basis; offene Woerterbuecher (`aufwandfaktoren`, `dossierDefaults.*bewertungen`)
 * duerfen dagegen neue Schluessel tragen und werden ueber `offen` ausgenommen.
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

/**
 * Wurzeln, unter denen der Anwender eigene Schluessel anlegen darf. `aufwandfaktoren`
 * ist der tragende Fall: Ein rein konfigurativ ergaenzter Faktor ist der Nachweis fuer
 * FF 1 (A-10) und darf projektbezogen nicht an einer Schluesselpruefung scheitern.
 */
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
