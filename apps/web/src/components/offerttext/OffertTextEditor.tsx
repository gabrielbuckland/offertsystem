'use client';

/**
 * WYSIWYG-Editor des Offerttexts (Spec 2026-08-27 §3). StarterKit ist auf die
 * Teilmenge des Dokumentschemas eingeschränkt — was der Editor erzeugen kann, kann
 * das Schema tragen und der Renderer darstellen; alles andere ist abgeschaltet.
 *
 * C-1: Zwei strukturelle Sperren plus eine Schema-Absicherung als drittes Netz.
 * `ListItem` wird enger eingesetzt (`content: 'paragraph'` statt des StarterKit-
 * Standards `'paragraph block*'`), damit `Tab`/`sinkListItem` konstruktiv keine
 * verschachtelte Liste mehr erzeugen kann — die Verschachtelung scheitert an der
 * ProseMirror-Schemaprüfung, bevor sie entsteht. Das Einfügen der Preistabelle ist
 * gesperrt, solange der Cursor in einem Listenpunkt steht (dort wäre der Blockknoten
 * ebenfalls schemawidrig). Zusätzlich prüft `istGueltigesOffertDokument` jede Änderung
 * gegen dieselbe Zod-Teilmenge, BEVOR sie an `beiAenderung` (und damit an Autosave/
 * PUT) weitergereicht wird — eine Zurückweisung propagiert nichts und zeigt einen
 * Hinweis, statt einen Dokumentstand zu vererben, an dem jedes weitere Speichern des
 * Projekts scheiterte (siehe Review, Ort: apps/web/src/app/api/projekt/[id]/route.ts).
 */
import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
// Kein neuer npm-Eintrag: `@tiptap/extension-list-item` ist bereits über
// `@tiptap/starter-kit` (Version 2.27.2, siehe apps/web/package.json) transitiv
// installiert — derselbe Node-Modul-Baum, dieselbe gepinnte Version. Direkt
// importiert wird sie hier, weil `StarterKit.configure({ listItem: {...} })` nur die
// `ListItemOptions` (HTMLAttributes, Listennamen) durchreicht, nicht aber `content` —
// die Content-Regel lässt sich ausschliesslich über `ListItem.extend(...)` setzen.
import { ListItem } from '@tiptap/extension-list-item';
import type { OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';
import { PLATZHALTER_KATALOG } from '@offert/offer/src/vorlage/platzhalter.js';
import { istGueltigesOffertDokument } from './dokument-pruefung.js';
import { PlatzhalterKnoten, PlatzhalterTabelleKnoten } from './platzhalter-erweiterung.js';
import { Hinweis } from '../ui/hinweis.js';

// Enger als der StarterKit-Standard (`'paragraph block*'`): Ein Listenpunkt trägt hier
// ausschliesslich Absätze — genau das, was `dokument-schema.ts` (`listItem.content:
// z.array(paragraph).min(1)`) verlangt. `sinkListItem` (Tab) und das Einfügen eines
// Blockknotens IN einen Listenpunkt scheitern damit an der ProseMirror-Schemaprüfung.
const EingeschraenkterListenPunkt = ListItem.extend({ content: 'paragraph' });

export interface OffertTextEditorProps {
  readonly inhalt: OffertDokument;
  readonly beiAenderung: (dokument: OffertDokument) => void;
}

export function OffertTextEditor({ inhalt, beiAenderung }: OffertTextEditorProps) {
  const [formatHinweis, setFormatHinweis] = useState(false);
  const [inListenPunkt, setInListenPunkt] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false, code: false, codeBlock: false, horizontalRule: false,
        strike: false, hardBreak: false,
        listItem: false,
      }),
      EingeschraenkterListenPunkt,
      PlatzhalterKnoten, PlatzhalterTabelleKnoten,
    ],
    // `getJSON()` liefert loses ProseMirror-JSON; das Dokumentschema (dokument-schema.ts)
    // ist eine geschlossene Teilmenge davon. Der Server validiert per Zod ohnehin — der
    // Cast hier ist die Editor-seitige Annahme, dass StarterKit/PlatzhalterKnoten nur
    // Knoten erzeugen, die diese Teilmenge auch traegt; `istGueltigesOffertDokument`
    // (C-1) prüft diese Annahme bei jeder Änderung tatsächlich nach.
    content: inhalt as unknown as Record<string, unknown>,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON();
      if (!istGueltigesOffertDokument(json)) {
        setFormatHinweis(true);
        return;
      }
      setFormatHinweis(false);
      beiAenderung(json);
    },
  });

  // Haelt `inListenPunkt` als React-Zustand nach, damit das Einfügemenü die
  // Preistabelle-Option sperren kann, solange der Cursor in einem Listenpunkt steht
  // (C-1) — TipTap loest bei Selektions-/Inhaltswechseln keinen React-Rerender aus,
  // deshalb die eigene Abonnierung statt eines direkten `editor.isActive`-Aufrufs im
  // Render.
  useEffect(() => {
    if (editor === null) return;
    const aktualisiere = () => setInListenPunkt(editor.isActive('listItem'));
    editor.on('selectionUpdate', aktualisiere);
    editor.on('transaction', aktualisiere);
    aktualisiere();
    return () => {
      editor.off('selectionUpdate', aktualisiere);
      editor.off('transaction', aktualisiere);
    };
  }, [editor]);

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
              // C-1: In einem Listenpunkt wäre der Blockknoten schemawidrig (die
              // Zod-Teilmenge lässt in `listItem.content` nur Absätze zu) — die Option
              // ist deshalb bereits über `disabled` gesperrt; dieser Schutz greift
              // zusätzlich, falls sie dennoch programmatisch ausgewählt würde.
              if (inListenPunkt) return;
              editor.chain().focus().insertContent({ type: 'platzhalterTabelle' }).run();
            } else {
              editor.chain().focus().insertContent({ type: 'platzhalter', attrs: { id } }).run();
            }
          }}
        >
          <option value="">Platzhalter einfügen …</option>
          {PLATZHALTER_KATALOG.map((e) => (
            <option key={e.id} value={e.id} disabled={e.id === 'preistabelle' && inListenPunkt}>
              {e.bezeichnung}
            </option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} className="prose-sm min-h-64 p-3" />
      {formatHinweis && (
        <div className="border-t border-neutral-200 p-2">
          <Hinweis art="warnung">
            Diese Formatierung wird in der Offerte nicht unterstützt.
          </Hinweis>
        </div>
      )}
    </div>
  );
}
