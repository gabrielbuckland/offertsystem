'use client';

/**
 * Pflege der GLOBALEN Offerttext-Vorlage (Spec 2026-08-27 §3). Gespeichert wird
 * explizit, nicht bei jedem Tastendruck: die Vorlage betrifft alle künftigen Offerten,
 * die 422-Befunde der Route gehören deshalb VOR das Sichern, nicht in ein stilles
 * Autosave.
 */
import { useEffect, useState } from 'react';
import type { OffertDokument } from '@offert/offer/src/vorlage/dokument-schema.js';
import { OffertTextEditor } from './OffertTextEditor.js';
import { Hinweis } from '../ui/hinweis.js';

interface Vorlage { readonly version: string; readonly inhalt: OffertDokument }

export function VorlagenEditorSeite() {
  const [vorlage, setzeVorlage] = useState<Vorlage | undefined>(undefined);
  const [ladeFehler, setzeLadeFehler] = useState(false);
  const [befunde, setzeBefunde] = useState<readonly { pfad: string; text: string }[]>([]);
  const [status, setzeStatus] = useState<'' | 'gespeichert' | 'fehler'>('');

  useEffect(() => {
    // I-4: `a.ok` geprueft, sonst blieb die Seite bei einem defekten Vorlagenartefakt
    // kommentarlos leer.
    void fetch('/api/vorlage')
      .then((a) => {
        if (!a.ok) throw new Error('vorlage-ladefehler');
        return a.json() as Promise<Vorlage>;
      })
      .then(setzeVorlage)
      .catch(() => setzeLadeFehler(true));
  }, []);

  if (ladeFehler) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-lg font-semibold">Offertvorlage</h1>
        <Hinweis art="fehler">
          Die Offerttext-Vorlage konnte nicht geladen werden. Bitte Verbindung prüfen
          und Seite neu laden.
        </Hinweis>
      </main>
    );
  }
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
