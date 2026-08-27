/**
 * TipTap-Knoten für die Platzhalter (Spec 2026-08-27 §2). Atomar: Ein Platzhalter wird
 * eingefügt und gelöscht, nie zerschrieben — die Serialisierung entspricht exakt der
 * Zod-Teilmenge in packages/offer (dokument-schema.ts); TipTap bleibt reine
 * Editor-Schicht ohne eigenes Persistenzformat.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { PLATZHALTER_KATALOG } from '@offert/offer/src/vorlage/platzhalter.js';

// `string` statt der engeren `PLATZHALTER_KATALOG`-Vereinigung (M-1): Nachgeschlagen
// wird hier mit `node.attrs['id']`, einem rohen Editor-Attribut — dessen Gültigkeit
// stellt die Zod-Teilmenge (dokument-schema.ts) sicher, nicht dieser Lookup.
const BEZEICHNUNG = new Map<string, string>(
  PLATZHALTER_KATALOG.map((e) => [e.id, e.bezeichnung]),
);

export const PlatzhalterKnoten = Node.create({
  name: 'platzhalter',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() { return { id: { default: '' } }; },
  parseHTML() { return [{ tag: 'span[data-platzhalter]' }]; },
  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs['id'] as string;
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-platzhalter': id,
      class: 'rounded bg-neutral-200 px-1 py-0.5 text-sm',
      title: BEZEICHNUNG.get(id) ?? id,
    }), `⟨${BEZEICHNUNG.get(id) ?? id}⟩`];
  },
});

export const PlatzhalterTabelleKnoten = Node.create({
  name: 'platzhalterTabelle',
  group: 'block',
  atom: true,
  parseHTML() { return [{ tag: 'div[data-platzhalter-tabelle]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-platzhalter-tabelle': 'true',
      class: 'my-2 rounded border border-dashed border-neutral-400 p-2 text-sm text-neutral-600',
    }), '⟨Preistabelle je Wohnung — wird beim Finalisieren eingesetzt⟩'];
  },
});
