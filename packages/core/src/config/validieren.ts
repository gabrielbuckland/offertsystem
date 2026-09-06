// Keine Formel. Ein Zod-Artefakt fuer alle drei Pruefebenen (NFA-08, AK-1). Keine
// handgeschriebene interface-Definition — alle Typen entstehen per z.infer, damit
// Laufzeit- und Uebersetzungszeitpruefung nicht auseinanderlaufen koennen. Eine
// verletzende Konfiguration wird ganz oder gar nicht angenommen (kein --force-Pfad).
import { z } from 'zod';
import { pruefeEbene2 } from './ebene2.js';
import { pruefeEbene3 } from './ebene3.js';
import {
  fehler,
  istKonfigurationsFehler,
  type KonfigurationsFehler,
} from './fehlercodes.js';
import { RohKonfigurationSchema } from './schema.js';

export const KonfigurationSchema = RohKonfigurationSchema.superRefine((konfiguration, ctx) => {
  const ebene2 = pruefeEbene2(konfiguration);
  const befunde = ebene2.length > 0 ? ebene2 : pruefeEbene3(konfiguration);
  for (const befund of befunde) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: befund.code, params: { cfg: befund } });
  }
});

export type OffertKonfiguration = z.infer<typeof KonfigurationSchema>;
export type Aufwandfaktor = OffertKonfiguration['aufwandfaktoren'][string];
export type Stuetzstelle = OffertKonfiguration['honorar']['stuetzstellen'][number];

export type KonfigurationsErgebnis =
  | { readonly ok: true; readonly wert: OffertKonfiguration }
  | { readonly ok: false; readonly fehler: readonly KonfigurationsFehler[] };

function pfadVon(issue: z.ZodIssue): string {
  return issue.path
    .map((teil) => (typeof teil === 'number' ? `[${teil}]` : `.${teil}`))
    .join('')
    .replace(/^\./, '');
}

function uebersetzeIssue(issue: z.ZodIssue): KonfigurationsFehler {
  if (issue.code === z.ZodIssueCode.custom) {
    const rohParams: unknown = (issue as { params?: unknown }).params;
    const kandidat: unknown =
      typeof rohParams === 'object' && rohParams !== null
        ? (rohParams as Record<string, unknown>)['cfg']
        : undefined;
    if (istKonfigurationsFehler(kandidat)) return kandidat;
    return fehler('CFG_SCHEMA_TYPE', pfadVon(issue), { hinweis: issue.message });
  }

  const pfad = pfadVon(issue);

  if (issue.code === z.ZodIssueCode.unrecognized_keys) {
    return fehler('CFG_SCHEMA_UNKNOWN_KEY', pfad === '' ? '(wurzel)' : pfad, {
      schluessel: issue.keys.join(', '),
    });
  }

  if (issue.code === z.ZodIssueCode.invalid_literal) {
    if (pfad === 'meta.schemaVersion') {
      return fehler('CFG_SCHEMA_VERSION', pfad, {
        ist: String(issue.received),
        soll: String(issue.expected),
      });
    }
    return fehler('CFG_SCHEMA_TYPE', pfad, {
      erwartet: String(issue.expected),
      erhalten: String(issue.received),
    });
  }

  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    if (pfad.endsWith('.strategie')) {
      return fehler('CFG_STRATEGY_UNKNOWN', pfad, {
        bezeichner: String(issue.received),
        verfuegbare: issue.options.join(', '),
      });
    }
    return fehler('CFG_SCHEMA_TYPE', pfad, {
      erwartet: issue.options.join(' | '),
      erhalten: String(issue.received),
    });
  }

  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.received === 'undefined') {
      return fehler('CFG_SCHEMA_MISSING', pfad, { erwartet: issue.expected });
    }
    return fehler('CFG_SCHEMA_TYPE', pfad, {
      erwartet: issue.expected,
      erhalten: issue.received,
    });
  }

  return fehler('CFG_SCHEMA_TYPE', pfad, { hinweis: issue.message });
}

export function validiereKonfiguration(roh: unknown): KonfigurationsErgebnis {
  const ergebnis = KonfigurationSchema.safeParse(roh);
  if (ergebnis.success) return { ok: true, wert: ergebnis.data };
  return { ok: false, fehler: ergebnis.error.issues.map(uebersetzeIssue) };
}
