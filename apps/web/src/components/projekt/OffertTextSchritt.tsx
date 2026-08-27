'use client';

/**
 * Projektspezifischer Offerttext (Spec 2026-08-27 §3): Erst beim ersten Bearbeiten
 * entsteht die Kopie der globalen Vorlage im Projekt — ein Projekt ohne Kopie
 * finalisiert gegen die jeweils aktuelle Vorlage (gleiches Ergebnis, kein Sonderpfad).
 */
import { useEffect, useState } from 'react';
import type { OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';
import type { Projekt } from '../../server/projekt-schema.js';
import { OffertTextEditor } from '../offerttext/OffertTextEditor.js';

export interface OffertTextSchrittProps {
  readonly projekt: Projekt;
  readonly aendere: (projekt: Projekt) => void;
}

export function OffertTextSchritt({ projekt, aendere }: OffertTextSchrittProps) {
  const [vorlage, setzeVorlage] = useState<OffertDokument | undefined>(undefined);
  useEffect(() => {
    if (projekt.offertText !== undefined) return;
    void fetch('/api/vorlage')
      .then((a) => a.json())
      .then((v: { inhalt: OffertDokument }) => setzeVorlage(v.inhalt));
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
            onClick={() => aendere({ ...projekt, offertText: undefined })}
          >
            Auf Vorlage zurücksetzen
          </button>
        )}
      </div>
      {inhalt === undefined ? null : (
        <OffertTextEditor
          key={projekt.offertText === undefined ? 'vorlage' : 'projekt'}
          inhalt={inhalt}
          beiAenderung={(d) => aendere({ ...projekt, offertText: d })}
        />
      )}
    </section>
  );
}
