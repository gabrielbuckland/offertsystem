'use client';

/**
 * Pflege der GLOBALEN Offerttext-Vorlage (Spec 2026-08-27 §3). Gespeichert wird
 * explizit, nicht bei jedem Tastendruck: Die Vorlage betrifft alle künftigen Offerten,
 * die 422-Befunde der Route gehören deshalb VOR das Sichern, nicht in ein stilles
 * Autosave.
 */
import { useEffect, useState } from 'react';
import type { OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';
import { OffertTextEditor } from './OffertTextEditor.js';

interface Vorlage { readonly version: string; readonly inhalt: OffertDokument }

export function VorlagenEditorSeite() {
  const [vorlage, setzeVorlage] = useState<Vorlage | undefined>(undefined);
  const [befunde, setzeBefunde] = useState<readonly { pfad: string; text: string }[]>([]);
  const [status, setzeStatus] = useState<'' | 'gespeichert' | 'fehler'>('');

  useEffect(() => {
    void fetch('/api/vorlage').then((a) => a.json()).then(setzeVorlage);
  }, []);
  if (vorlage === undefined) return null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-lg font-semibold">Offertvorlage</h1>
      {befunde.length === 0 ? null : (
        <ul className="mb-3 list-disc pl-5 text-sm text-red-700">
          {befunde.map((b, i) => <li key={i}>{b.pfad}: {b.text}</li>)}
        </ul>
      )}
      <OffertTextEditor
        inhalt={vorlage.inhalt}
        beiAenderung={(inhalt) => { setzeVorlage({ ...vorlage, inhalt }); setzeStatus(''); }}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button" className="rounded border px-3 py-1"
          onClick={() => {
            void fetch('/api/vorlage', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(vorlage),
            }).then(async (a) => {
              if (a.ok) { setzeBefunde([]); setzeStatus('gespeichert'); return; }
              const koerper = await a.json() as { befunde?: typeof befunde };
              setzeBefunde(koerper.befunde ?? []); setzeStatus('fehler');
            });
          }}
        >
          Speichern
        </button>
        {status === 'gespeichert' ? <span className="text-sm">Gespeichert.</span> : null}
      </div>
    </main>
  );
}
