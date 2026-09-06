/**
 * Keine Formel. Zod-Schema der Offerttext-Dokumente.
 *
 * Bewusst eine TEILMENGE des ProseMirror-JSON: Jeder erlaubte Knoten hat genau einen
 * Renderpfad (VermarktungsOfferte) und eine Editor-Entsprechung — ein durchgereichter
 * unbekannter Knoten wäre Inhalt, den der Renderer stumm verschluckt.
 *
 * TipTap kommt hier NICHT vor: Auflösung und Rendering laufen serverseitig ohne
 * Editor-Bibliothek; der Editor (apps/web) wird auf dieselbe Teilmenge konfiguriert.
 */
import { z } from 'zod';

/**
 * Handgeschriebene Typen statt `any`: Die generische `baueBloecke`-Funktion gibt
 * TypeScript nicht genug Kontext, um Knotenstrukturen zu inferieren (variable
 * Inline-/Blockbestandteile). Explizite Interfaces annotieren die Zod-Schemas so,
 * dass `z.infer` echte Typen produziert.
 */

// Inline-Knotentypen (Text-Level)
export interface TextKnoten {
  readonly type: 'text';
  readonly text: string;
  readonly marks?: readonly { readonly type: 'bold' | 'italic' }[];
}

export interface PlatzhalterInline {
  readonly type: 'platzhalter';
  readonly attrs: { readonly id: string };
}

// Block-Knotentypen (generisch über ihren Inline-Bestand)
export interface Absatz<I> {
  readonly type: 'paragraph';
  readonly content?: readonly I[];
}

export interface Ueberschrift<I> {
  readonly type: 'heading';
  readonly attrs: { readonly level: 1 | 2 | 3 };
  readonly content?: readonly I[];
}

export interface ListenPunkt<I> {
  readonly type: 'listItem';
  readonly content: readonly Absatz<I>[];
}

export interface AufzaehlListe<I> {
  readonly type: 'bulletList';
  readonly content: readonly ListenPunkt<I>[];
}

export interface NummernListe<I> {
  readonly type: 'orderedList';
  readonly content: readonly ListenPunkt<I>[];
}

export interface PlatzhalterTabelle {
  readonly type: 'platzhalterTabelle';
}

export interface Preistabelle {
  readonly type: 'preistabelle';
  readonly attrs: { readonly zeilen: readonly PreisZeile[] };
}

// Verbundtypen: alle Blöcke einer bestimmten Editierbarkeit
export type EditierbarerBlock =
  | Absatz<TextKnoten | PlatzhalterInline>
  | Ueberschrift<TextKnoten | PlatzhalterInline>
  | AufzaehlListe<TextKnoten | PlatzhalterInline>
  | NummernListe<TextKnoten | PlatzhalterInline>
  | PlatzhalterTabelle;

export type AufgeloesterBlock =
  | Absatz<TextKnoten>
  | Ueberschrift<TextKnoten>
  | AufzaehlListe<TextKnoten>
  | NummernListe<TextKnoten>
  | Preistabelle;

// Komplette Dokumenttypen
export interface OffertDokument {
  readonly type: 'doc';
  readonly content: readonly EditierbarerBlock[];
}

export interface AufgeloestesDokument {
  readonly type: 'doc';
  readonly content: readonly AufgeloesterBlock[];
}

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

export const offertDokumentSchema: z.ZodType<OffertDokument> = baueBloecke(
  z.union([textSchema, platzhalterSchema]), [platzhalterTabelleSchema],
);

export const aufgeloestesDokumentSchema: z.ZodType<AufgeloestesDokument> = baueBloecke(
  textSchema, [preistabelleSchema],
);

/** Platzhalter-Vorkommen mit Knotenart: `platzhalter` (inline) oder
 *  `platzhalterTabelle` (block). Beide können dieselbe `id` tragen (z. B.
 *  `preistabelle`), sind aber NICHT austauschbar — `aufloesung.ts` kennt
 *  `preistabelle` ausschliesslich als Blockknoten. */
export interface PlatzhalterVorkommen {
  readonly id: string;
  readonly art: 'inline' | 'block';
}

/** Reihenfolge des Auftretens, `platzhalterTabelle` erscheint als `preistabelle` — die
 *  ID, unter der sie im Katalog und im Einfügemenü geführt wird. */
export function sammlePlatzhalterIds(dokument: OffertDokument): readonly PlatzhalterVorkommen[] {
  const vorkommen: PlatzhalterVorkommen[] = [];
  const besuche = (knoten: unknown): void => {
    if (Array.isArray(knoten)) { knoten.forEach(besuche); return; }
    if (typeof knoten !== 'object' || knoten === null) return;
    const k = knoten as { type?: string; attrs?: { id?: string }; content?: unknown };
    if (k.type === 'platzhalter' && k.attrs?.id !== undefined) {
      vorkommen.push({ id: k.attrs.id, art: 'inline' });
    }
    if (k.type === 'platzhalterTabelle') vorkommen.push({ id: 'preistabelle', art: 'block' });
    besuche(k.content);
  };
  besuche(dokument.content);
  return vorkommen;
}
