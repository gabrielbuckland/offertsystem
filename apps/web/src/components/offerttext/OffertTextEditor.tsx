'use client';

// WYSIWYG-Editor des Offerttexts (Spec 2026-08-27 §3). StarterKit ist auf die Teilmenge des
// Dokumentschemas eingeschraenkt.
// C-1: Drei Netze gegen schemawidrigen Inhalt — `ListItem.content: 'paragraph'` (verhindert
// verschachtelte Listen via Tab strukturell), die Preistabelle-Sperre in einem Listenpunkt,
// und `istGueltigesOffertDokument`, das jede Aenderung vor `beiAenderung` (Autosave/PUT)
// gegen dieselbe Zod-Teilmenge prueft — eine Zurueckweisung propagiert nichts.
import { useEffect, useState } from 'react';
import { Bold, Heading1, Heading2, Italic, List } from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
// Direkter Import noetig, weil `StarterKit.configure({ listItem: {...} })` nur
// `ListItemOptions` durchreicht, nicht `content` — das laesst sich nur ueber
// `ListItem.extend(...)` setzen.
import { ListItem } from '@tiptap/extension-list-item';
import type { OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';
import { PLATZHALTER_KATALOG } from '@offert/offer/src/vorlage/platzhalter.js';
import { istGueltigesOffertDokument } from './dokument-pruefung.js';
import { PlatzhalterKnoten, PlatzhalterTabelleKnoten } from './platzhalter-erweiterung.js';
import { Hinweis } from '../ui/hinweis.js';

// Enger als StarterKit-Standard (`'paragraph block*'`), passend zu `dokument-schema.ts`
// (`listItem.content: z.array(paragraph).min(1)`) — siehe C-1 oben.
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
    // Cast ist die Annahme, dass StarterKit/PlatzhalterKnoten nur Knoten im Dokumentschema
    // erzeugen; `istGueltigesOffertDokument` (C-1) prueft das bei jeder Aenderung nach.
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

  // TipTap loest bei Selektions-/Inhaltswechseln keinen React-Rerender aus, deshalb die
  // eigene Abonnierung. `setzeAuswahlstand` erzwingt den Rerender fuer die Aktiv-Zustaende
  // der Werkzeugleiste; `inListenPunkt` sperrt die Preistabelle-Option (C-1).
  const [, setzeAuswahlstand] = useState(0);
  useEffect(() => {
    if (editor === null) return;
    const aktualisiere = () => {
      setInListenPunkt(editor.isActive('listItem'));
      setzeAuswahlstand((n) => n + 1);
    };
    editor.on('selectionUpdate', aktualisiere);
    editor.on('transaction', aktualisiere);
    aktualisiere();
    return () => {
      editor.off('selectionUpdate', aktualisiere);
      editor.off('transaction', aktualisiere);
    };
  }, [editor]);

  if (editor === null) return null;

  function WerkzeugKnopf(
    { beschriftung, aktiv, beiKlick, Icon }: {
      readonly beschriftung: string;
      readonly aktiv: boolean;
      readonly beiKlick: () => void;
      readonly Icon: typeof Bold;
    },
  ) {
    return (
      <button
        type="button"
        title={beschriftung}
        aria-label={beschriftung}
        aria-pressed={aktiv}
        // preventDefault verhindert, dass mousedown die Textauswahl vor dem Befehl aufhebt.
        onMouseDown={(e) => e.preventDefault()}
        className={`inline-flex size-8 items-center justify-center rounded-md transition-colors ${
          aktiv
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground/70 hover:bg-muted hover:text-foreground'
        }`}
        onClick={beiKlick}
      >
        <Icon className="size-4" />
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-1.5">
        <WerkzeugKnopf
          beschriftung="Titel" Icon={Heading1}
          aktiv={editor.isActive('heading', { level: 1 })}
          beiKlick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <WerkzeugKnopf
          beschriftung="Untertitel" Icon={Heading2}
          aktiv={editor.isActive('heading', { level: 2 })}
          beiKlick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <WerkzeugKnopf
          beschriftung="Fett" Icon={Bold}
          aktiv={editor.isActive('bold')}
          beiKlick={() => editor.chain().focus().toggleBold().run()}
        />
        <WerkzeugKnopf
          beschriftung="Kursiv" Icon={Italic}
          aktiv={editor.isActive('italic')}
          beiKlick={() => editor.chain().focus().toggleItalic().run()}
        />
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <WerkzeugKnopf
          beschriftung="Aufzählung" Icon={List}
          aktiv={editor.isActive('bulletList')}
          beiKlick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (id === '') return;
            if (id === 'preistabelle') {
              // Doppelte Absicherung zur `disabled`-Option (C-1), falls dennoch
              // programmatisch ausgewaehlt.
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
      <EditorContent editor={editor} className="offert-editor" />
      {formatHinweis && (
        <div className="border-t border-border p-2">
          <Hinweis art="warnung">
            Diese Formatierung wird in der Offerte nicht unterstützt.
          </Hinweis>
        </div>
      )}
    </div>
  );
}
