'use client';

/**
 * Projektspezifischer Offerttext (Spec 2026-08-27 §3): Die Kopie der globalen Vorlage
 * entsteht beim ERSTEN ÖFFNEN dieses Editors im Projekt (Spec §1, wörtlich) — sobald
 * die Vorlage geladen ist, wird sie sofort in den Projektstand geschrieben
 * (`aendere`), nicht erst beim ersten Tastendruck.
 *
 * I-2: Vorher stand die Materialisierung im ersten `beiAenderung`-Aufruf, und der
 * Editor-`key` folgte `projekt.offertText === undefined`. Das erste Zeichen setzte
 * `offertText`, der Key wechselte 'vorlage' -> 'projekt', React demontierte den Editor
 * MITTEN in der Eingabe — Fokus und Cursor waren weg. Der `key` bleibt jetzt fuer den
 * Normalfall stabil; nur der explizite «Zurücksetzen»-Klick erhöht `zuruecksetzenZaehler`
 * und erzwingt DAMIT gezielt einen Remount (TipTaps `useEditor` uebernimmt eine
 * geänderte `inhalt`-Prop sonst nicht automatisch in den Editorzustand).
 */
import { useEffect, useState } from 'react';
import type { OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';
import type { Projekt } from '../../server/projekt-schema.js';
import { OffertTextEditor } from '../offerttext/OffertTextEditor.js';
import { Hinweis } from '../ui/hinweis.js';

export interface OffertTextSchrittProps {
  readonly projekt: Projekt;
  readonly aendere: (projekt: Projekt) => void;
}

export function OffertTextSchritt({ projekt, aendere }: OffertTextSchrittProps) {
  const [vorlage, setzeVorlage] = useState<OffertDokument | undefined>(undefined);
  const [ladeFehler, setzeLadeFehler] = useState(false);
  const [zuruecksetzenZaehler, setzeZuruecksetzenZaehler] = useState(0);

  useEffect(() => {
    if (projekt.offertText !== undefined) return;
    setzeLadeFehler(false);
    void fetch('/api/vorlage')
      .then((a) => {
        // I-4: `a.ok` ungeprueft liesse eine 500-Fehlerseite unbemerkt durchfallen
        // (`a.json()` wirft dann, oder — bei einer JSON-Fehlerantwort — `vorlage.inhalt`
        // waere `undefined` und ginge unbemerkt als `content` an TipTap).
        if (!a.ok) throw new Error('vorlage-ladefehler');
        return a.json() as Promise<{ readonly inhalt: OffertDokument }>;
      })
      .then((v) => {
        setzeVorlage(v.inhalt);
        // Kopie sofort materialisieren (Spec §1: „beim ersten Öffnen“), nicht erst beim
        // ersten Tastendruck — behebt I-2 an der Wurzel.
        aendere({ ...projekt, offertText: v.inhalt });
      })
      .catch(() => setzeLadeFehler(true));
    // `projekt`/`aendere` bewusst nicht in den Abhaengigkeiten: Der Effekt soll genau
    // EINMAL laufen, wenn `offertText` auf `undefined` wechselt (erstes Öffnen oder
    // Zurücksetzen) — nicht bei jeder Änderung an einem anderen Projektfeld erneut.
  }, [projekt.offertText]);

  const inhalt = projekt.offertText ?? vorlage;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Offerttext</h2>
        {projekt.offertText === undefined ? (
          <span className="text-sm text-neutral-500">Globale Vorlage</span>
        ) : (
          <button
            type="button" className="text-sm underline"
            onClick={() => {
              aendere({ ...projekt, offertText: undefined });
              setzeZuruecksetzenZaehler((n) => n + 1);
            }}
          >
            Auf Vorlage zurücksetzen
          </button>
        )}
      </div>
      {ladeFehler && (
        <Hinweis art="fehler" className="mb-3">
          Die Offerttext-Vorlage konnte nicht geladen werden. Bitte Verbindung prüfen
          und Seite neu laden.
        </Hinweis>
      )}
      {inhalt === undefined ? null : (
        <OffertTextEditor
          key={zuruecksetzenZaehler}
          inhalt={inhalt}
          beiAenderung={(d) => aendere({ ...projekt, offertText: d })}
        />
      )}
    </section>
  );
}
