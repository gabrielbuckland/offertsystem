/**
 * Keine Formel. Schema des Projektartefakts (Arbeitsstand), nicht der Offerte.
 *
 * Abgrenzung zu `erfassungsSchema`: Dieses Schema beschreibt einen VERAENDERLICHEN
 * Zwischenstand und laesst deshalb Unvollstaendigkeit zu — ein neu angelegtes Projekt hat
 * weder Einheiten noch Bewertungen. Die Vollstaendigkeitsregeln der Berechnung greifen
 * erst bei der Projektion (`projektion.ts`); sie hier zu wiederholen haette einen zweiten
 * Regelort geschaffen.
 *
 * Aggregatregeln stehen in `superRefine`, weil eine Kollision eine Aussage ueber die
 * Menge ist und nicht ueber einen einzelnen Wert (I-01).
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

const parametrisierungSchema = z.object({
  flaecheInnen: z.number().positive(),
  flaecheAussen: z.number().nonnegative(),
  stockwerk: z.number().int(),
  energielabel: z.string(),
  zustandsbewertungen: z.record(z.string()),
  qualitaetsbewertungen: z.record(z.string()),
  anzahlBadezimmer: z.number().int().nonnegative(),
  lift: z.boolean(),
  baujahr: z.number().int(),
  heizungsart: z.string(),
}).strict();

const referenzobjektSchema = z.object({
  id: z.string().min(1),
  zimmerzahl: z.number().min(1).max(12),
  parametrisierung: parametrisierungSchema,
  bewertung: z.object({
    wert: z.number().int(),
    bewertungsdatum: z.string().min(1),
    konfidenzklasse: z.string().min(1),
  }).strict().optional(),
}).strict();

const anpassungsSpalteSchema = z.object({
  id: z.string().min(1),
  bezeichnung: z.string().trim().min(1),
  erfassungsform: z.enum(['relativ', 'absolut']),
  vorgabewert: z.number(),
}).strict();

const manuelleAnpassungSchema = z.object({
  erfassungsform: z.enum(['relativ', 'absolut']),
  wert: z.number(),
  begruendung: z.string().trim().min(1),
}).strict();

const einheitSchema = z.object({
  id: z.string().min(1),
  wohnungsnummer: z.string().trim().min(1),
  referenzobjektId: z.string().min(1),
  flaecheInnen: z.number().nonnegative(),
  flaecheAussen: z.number().nonnegative(),
  stockwerk: z.number().int(),
  spaltenwerte: z.record(z.number()),
  manuelleAnpassungen: z.array(manuelleAnpassungSchema),
}).strict();

export const projektSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().uuid(),
  adresse: z.object({
    strasse: z.string().trim().min(1),
    hausnummer: z.string().trim().min(1),
    plz: z.string().regex(/^\d{4}$/),
    ort: z.string().trim().min(1),
  }).strict(),
  referenzobjekte: z.array(referenzobjektSchema),
  anpassungsSpalten: z.array(anpassungsSpalteSchema),
  einheiten: z.array(einheitSchema),
  aufwandfaktoren: z.record(z.number()),
  meta: z.object({
    erstelltAm: z.string().min(1),
    geaendertAm: z.string().min(1),
  }).strict(),
}).strict().superRefine((p, ctx) => {
  const bekannt = new Set(p.referenzobjekte.map((r) => r.id));
  p.einheiten.forEach((e, i) => {
    if (!bekannt.has(e.referenzobjektId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['einheiten', i, 'referenzobjektId'],
        params: { regel: 'REFERENZOBJEKT_UNBEKANNT' },
        message: 'REFERENZOBJEKT_UNBEKANNT',
      });
    }
  });

  const gesehen = new Map<string, number[]>();
  p.einheiten.forEach((e, i) => {
    gesehen.set(e.wohnungsnummer, [...(gesehen.get(e.wohnungsnummer) ?? []), i]);
  });
  for (const [nummer, indizes] of gesehen) {
    if (indizes.length > 1) {
      for (const i of indizes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['einheiten', i, 'wohnungsnummer'],
          params: { regel: 'NUMMER_DOPPELT', nummer },
          message: 'NUMMER_DOPPELT',
        });
      }
    }
  }

  // Die Kennung (`id`) ist der Schluessel fuer Basispreis und Anpassungen (projektion.ts)
  // und darf sich deshalb NICHT ueber die Wohnungsnummer hinweg mit der Nummernpruefung
  // begnuegen: Eine editierte Wohnungsnummer (Einheitentabelle) laesst die Kennung
  // unveraendert, ein Generatorlauf koennte trotzdem eine bereits vergebene Kennung
  // erneut zuteilen (siehe einheiten-generator.ts). Ohne diese eigene Regel wuerde eine
  // doppelte Kennung die Validierung unbemerkt passieren.
  const idGesehen = new Map<string, number[]>();
  p.einheiten.forEach((e, i) => {
    idGesehen.set(e.id, [...(idGesehen.get(e.id) ?? []), i]);
  });
  for (const [id, indizes] of idGesehen) {
    if (indizes.length > 1) {
      for (const i of indizes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['einheiten', i, 'id'],
          params: { regel: 'EINHEIT_ID_DOPPELT', id },
          message: 'EINHEIT_ID_DOPPELT',
        });
      }
    }
  }
});

export type Projekt = z.infer<typeof projektSchema>;
export type Referenzobjekt = z.infer<typeof referenzobjektSchema>;
export type AnpassungsSpalte = z.infer<typeof anpassungsSpalteSchema>;
export type ProjektEinheit = z.infer<typeof einheitSchema>;
