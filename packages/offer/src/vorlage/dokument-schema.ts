/**
 * Keine Formel. Zod-Schema der Offerttext-Dokumente (Spec 2026-08-27 §2).
 *
 * Bewusst eine TEILMENGE des ProseMirror-JSON — nicht dessen ganze Ausdrucksmacht:
 * Jeder hier erlaubte Knoten hat genau einen Renderpfad (VermarktungsOfferte) und eine
 * Editor-Entsprechung. Ein durchgereichter unbekannter Knoten wäre Inhalt, den der
 * Renderer stumm verschluckt — deshalb strikt und geschlossen.
 *
 * TipTap selbst kommt hier NICHT vor: Auflösung und Rendering laufen serverseitig und
 * im Test ohne Editor-Bibliothek; der Editor (apps/web) wird auf dieselbe Teilmenge
 * konfiguriert.
 */
import { z } from 'zod';

const markSchema = z.object({ type: z.enum(['bold', 'italic']) }).strict();

const textSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
  marks: z.array(markSchema).min(1).optional(),
}).strict();

const platzhalterSchema = z.object({
  type: z.literal('platzhalter'),
  attrs: z.object({ id: z.string().min(1) }).strict(),
}).strict();

const platzhalterTabelleSchema = z.object({
  type: z.literal('platzhalterTabelle'),
}).strict();

export const preisZeileSchema = z.object({
  einheit: z.string().min(1),
  flaeche: z.string().min(1),
  preis: z.string().min(1),
}).strict();
export type PreisZeile = z.infer<typeof preisZeileSchema>;

const preistabelleSchema = z.object({
  type: z.literal('preistabelle'),
  attrs: z.object({ zeilen: z.array(preisZeileSchema) }).strict(),
}).strict();

/** Baut die Blockebene für einen gegebenen Inline-Bestand auf — die Struktur ist für
 *  editierbares und aufgelöstes Dokument identisch, nur der Inline-/Blockbestand
 *  unterscheidet sich. */
function baueBloecke<I extends z.ZodTypeAny, B extends z.ZodTypeAny>(
  inline: I, zusatzBloecke: readonly B[],
) {
  const paragraph = z.object({
    type: z.literal('paragraph'),
    content: z.array(inline).optional(),
  }).strict();
  const heading = z.object({
    type: z.literal('heading'),
    attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict(),
    content: z.array(inline).optional(),
  }).strict();
  const listItem = z.object({
    type: z.literal('listItem'),
    content: z.array(paragraph).min(1),
  }).strict();
  const bulletList = z.object({
    type: z.literal('bulletList'),
    content: z.array(listItem).min(1),
  }).strict();
  const orderedList = z.object({
    type: z.literal('orderedList'),
    content: z.array(listItem).min(1),
  }).strict();
  const block = z.union([paragraph, heading, bulletList, orderedList,
    ...zusatzBloecke] as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  return z.object({ type: z.literal('doc'), content: z.array(block).min(1) }).strict();
}

export const offertDokumentSchema = baueBloecke(
  z.union([textSchema, platzhalterSchema]), [platzhalterTabelleSchema],
);
export type OffertDokument = z.infer<typeof offertDokumentSchema>;

export const aufgeloestesDokumentSchema = baueBloecke(textSchema, [preistabelleSchema]);
export type AufgeloestesDokument = z.infer<typeof aufgeloestesDokumentSchema>;

/** Reihenfolge des Auftretens, `platzhalterTabelle` erscheint als `preistabelle` — die
 *  ID, unter der sie im Katalog und im Einfügemenü geführt wird. */
export function sammlePlatzhalterIds(dokument: OffertDokument): readonly string[] {
  const ids: string[] = [];
  const besuche = (knoten: unknown): void => {
    if (Array.isArray(knoten)) { knoten.forEach(besuche); return; }
    if (typeof knoten !== 'object' || knoten === null) return;
    const k = knoten as { type?: string; attrs?: { id?: string }; content?: unknown };
    if (k.type === 'platzhalter' && k.attrs?.id !== undefined) ids.push(k.attrs.id);
    if (k.type === 'platzhalterTabelle') ids.push('preistabelle');
    besuche(k.content);
  };
  besuche(dokument.content);
  return ids;
}
