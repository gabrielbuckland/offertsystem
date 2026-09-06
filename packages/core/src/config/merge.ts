// Keine Formel. Zwei-Ebenen-Merge: Ebene 1 firmenweite Basis, Ebene 2 Projekt-Teilbaum
// (keine zweite Konfigurationsdatei). Gesperrt nur `meta`/`api` (GESPERRTE_PFADE), Rest
// projektbezogen ueberschreibbar. Ebene 3 dadurch nicht mehr konstruktionsbedingt
// ausgeschlossen — Garantie traegt die Nachvalidierung im Ladepfad (konfigurations-lader.ts).
import { z } from 'zod';
import { fehler, type KonfigurationsFehler } from './fehlercodes.js';
import { DossierDefaultsSchema } from './schema.js';
import type { OffertKonfiguration } from './validieren.js';

export interface Preisanpassung {
  readonly faktor: number;
  readonly begruendung: string;
  // Verweist auf die Ursprungsvorlage, damit erkennbar bleibt ob eine Anpassung aus der
  // Vorlage stammt, veraendert oder frei erfasst ist (A-13). `| undefined` noetig, weil
  // Zod die optionale Eigenschaft bei exactOptionalPropertyTypes genau so ableitet.
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

// Nicht ueberschreibbar: `meta` (Schema-/Konfigversion), `api` (Betriebsparameter der
// Zugriffsschicht, gehoert der IT, nicht dem Auftraggeber — Rollentrennung US-08). Alles
// Uebrige ist ueberschreibbar; die Nachvalidierung im Ladepfad (konfigurations-lader.ts)
// ist die tragende Garantie und darf nicht uebersprungen werden.
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

// `zusammengefuehrteDefaults` ist bewusst die bereits zusammengefuehrte `dossierDefaults`,
// nicht die Firmenbasis: sonst wuerde eine projektbezogene Voreinstellung fuer Wohnungstypen
// mit eigenen `dossierParameter` verschluckt. Deshalb laeuft dieser Aufruf nach der
// Basis-Zusammenfuehrung.
function verschmelzeDossierParameter(
  zusammengefuehrteDefaults: unknown,
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

  // Ein Delta darf dossierDefaults durch einen Skalar oder null ersetzen; Schluesselmenge
  // wird dann leer, jeder Projektschluessel faellt als unbekannt auf. Befunde bleiben
  // bewusst stehen, dieselbe Form weist auch die Nachvalidierung im Ladepfad zurueck.
  const defaults = istObjekt(zusammengefuehrteDefaults) ? zusammengefuehrteDefaults : {};

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
      // Vergleich per Wert, nicht per Referenz: projektwert ist immer frisch geparst und
      // waere per !== nie gleich defaultwert, auch bei woertlicher Wiederholung.
      if (JSON.stringify(projektwert) !== JSON.stringify(defaultwert)) {
        protokoll.push({
          pfad: `dossierParameter.${wohnungstyp}.${schluessel}`,
          defaultwert,
          projektwert,
        });
      }
    }
    // Blattpruefung oben kennt nur die Schluesselmenge, nicht die Form der Werte —
    // deshalb hier zusaetzlich strikt gegen DossierDefaultsSchema pruefen.
    const geprueft = DossierDefaultsSchema.safeParse(zusammengesetzt);
    if (!geprueft.success) {
      for (const issue of geprueft.error.issues) {
        const pfad = `dossierParameter.${wohnungstyp}${issue.path.map((t) =>
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
    ergebnis[wohnungstyp] = geprueft.data;
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

// Objekte werden feldweise zusammengelegt, Arrays vollstaendig ersetzt (sonst koennte
// eine elementweise Zusammenfuehrung einen projektbezogen geloeschten Zu-/Abschlag
// stillschweigend wieder einfuehren). Unbekannter Schluessel ist Fehler, keine Warnung
// — sonst verschwaende ein Tippfehler die Uebersteuerung lautlos.
// `offen` (OFFENE_WURZELN, aktuell nur aufwandfaktoren) gilt nur auf oberster Ebene; in
// der Rekursion immer `false`, damit ein Tippfehler innerhalb eines neuen Faktors auffaellt.
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

// Wurzeln mit frei anlegbaren Schluesseln. aufwandfaktoren ist der tragende Fall:
// ein rein konfigurativ ergaenzter Faktor ist der Nachweis fuer FF 1 (A-10).
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

  // NACH der Schleife: `zusammengefuehrt['dossierDefaults']` traegt jetzt die
  // projektbezogenen Voreinstellungen, gegen die die Dossier-Parameter aufsetzen (W-3).
  const dossierParameter = verschmelzeDossierParameter(
    zusammengefuehrt['dossierDefaults'], ueberschreibungen['dossierParameter'], befunde, protokoll,
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
