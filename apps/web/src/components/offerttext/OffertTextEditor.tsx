'use client';

/**
 * WYSIWYG-Editor des Offerttexts (Spec 2026-08-27 §3). StarterKit ist auf die
 * Teilmenge des Dokumentschemas eingeschränkt — was der Editor erzeugen kann, kann
 * das Schema tragen und der Renderer darstellen; alles andere ist abgeschaltet.
 */
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';
import { PLATZHALTER_KATALOG } from '@offert/offer/src/vorlage/platzhalter.js';
import { PlatzhalterKnoten, PlatzhalterTabelleKnoten } from './platzhalter-erweiterung.js';

export interface OffertTextEditorProps {
  readonly inhalt: OffertDokument;
  readonly beiAenderung: (dokument: OffertDokument) => void;
}

export function OffertTextEditor({ inhalt, beiAenderung }: OffertTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false, code: false, codeBlock: false, horizontalRule: false,
        strike: false, hardBreak: false,
      }),
      PlatzhalterKnoten, PlatzhalterTabelleKnoten,
    ],
    // `getJSON()` liefert loses ProseMirror-JSON; das Dokumentschema (dokument-schema.ts)
    // ist eine geschlossene Teilmenge davon. Der Server validiert per Zod ohnehin — der
    // Cast hier ist die Editor-seitige Annahme, dass StarterKit/PlatzhalterKnoten nur
    // Knoten erzeugen, die diese Teilmenge auch traegt.
    content: inhalt as unknown as Record<string, unknown>,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => beiAenderung(e.getJSON() as unknown as OffertDokument),
  });
  if (editor === null) return null;

  const knopf = 'rounded border px-2 py-0.5 text-sm';
  return (
    <div className="rounded border border-neutral-300">
      <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-1.5">
        <button type="button" className={knopf}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          Titel
        </button>
        <button type="button" className={knopf}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          Untertitel
        </button>
        <button type="button" className={knopf}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          Fett
        </button>
        <button type="button" className={knopf}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          Kursiv
        </button>
        <button type="button" className={knopf}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Liste
        </button>
        <select
          className={knopf}
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (id === '') return;
            if (id === 'preistabelle') {
              editor.chain().focus().insertContent({ type: 'platzhalterTabelle' }).run();
            } else {
              editor.chain().focus().insertContent({ type: 'platzhalter', attrs: { id } }).run();
            }
          }}
        >
          <option value="">Platzhalter einfügen …</option>
          {PLATZHALTER_KATALOG.map((e) => (
            <option key={e.id} value={e.id}>{e.bezeichnung}</option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} className="prose-sm min-h-64 p-3" />
    </div>
  );
}
