'use client';

// zuruecksetzenZaehler erzwingt per Editor-key gezielt einen Remount: TipTaps useEditor
// uebernimmt eine geaenderte inhalt-Prop sonst nicht automatisch.
import { useEffect, useState } from 'react';
import type { OffertDokument } from '@offert/offer';
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
        // I-4: a.ok ungeprueft liesse eine 500-Fehlerseite unbemerkt durchfallen.
        if (!a.ok) throw new Error('vorlage-ladefehler');
        return a.json() as Promise<{ readonly inhalt: OffertDokument }>;
      })
      .then((v) => {
        setzeVorlage(v.inhalt);
        aendere({ ...projekt, offertText: v.inhalt });
      })
      .catch(() => setzeLadeFehler(true));
    // projekt/aendere bewusst nicht in den Abhaengigkeiten: soll nur laufen, wenn
    // offertText auf undefined wechselt.
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
