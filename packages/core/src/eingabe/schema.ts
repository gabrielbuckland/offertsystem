// Keine Formel. Typfamilie *Eingabe: permissiv, ohne Marken, aus dem Zod-Schema
// abgeleitet. Einzige Stelle mit Plausibilitaetsgrenzen (Spec 03 §2.1, I-02).
import { z } from 'zod';

export const adresseEingabeSchema = z.object({
  strasse: z.string().min(1),
  hausnummer: z.string().min(1),
  plz: z.string().regex(/^\d{4}$/),
  ort: z.string().min(1),
});

export const zuAbschlagEingabeSchema = z.object({
  faktor: z.number().finite(),
  begruendung: z.string(),
  erfassungsform: z.enum(['relativ', 'absolut']),
  erfassterBetrag: z.number().int().optional(),
  vorlageId: z.string().optional(),
});

export const parametrisierungEingabeSchema = z.object({
  flaecheInnen: z.number().finite().positive(),
  flaecheAussen: z.number().finite().nonnegative(),
  stockwerk: z.number().int(),
  energielabel: z.string(),
  zustandsbewertungen: z.record(z.string(), z.string()),
  qualitaetsbewertungen: z.record(z.string(), z.string()),
  anzahlBadezimmer: z.number().int().nonnegative(),
  lift: z.boolean(),
  baujahr: z.number().int(),
  heizungsart: z.string(),
});

export const wohnungstypEingabeSchema = z.object({
  id: z.string().min(1),
  zimmerzahl: z.number().min(1).max(12),
  parametrisierung: parametrisierungEingabeSchema,
});

export const einheitEingabeSchema = z.object({
  id: z.string().min(1),
  wohnungsnummer: z.string().min(1),
  wohnungstypId: z.string().min(1),
  flaecheInnen: z.number().finite().positive(),
  flaecheAussen: z.number().finite().nonnegative(),
  stockwerk: z.number().int(),
  anpassungen: z.array(zuAbschlagEingabeSchema),
});

export const liegenschaftEingabeSchema = z.object({
  id: z.string().min(1),
  adresse: adresseEingabeSchema,
  wohnungstypen: z.array(wohnungstypEingabeSchema).min(1),
  /**
   * Bewusst OHNE `.min(1)`: Die Regel «mindestens eine Einheit» gehoert dem Aggregat
   * (I-01) und wird von `erzeugeLiegenschaft` mit dem sprechenden Code `KEINE_EINHEIT`
   * gemeldet. Eine zusaetzliche Schemaschranke griffe frueher und ersetzte diesen Code
   * durch das generische `SCHEMA_VERLETZT` — die Aggregatregel waere dann zwar
   * vorhanden, aber ueber die Eingabeschicht nicht mehr erreichbar und damit unbelegt.
   */
  einheiten: z.array(einheitEingabeSchema),
});

export type LiegenschaftEingabe = z.infer<typeof liegenschaftEingabeSchema>;
