'use client';

// Rohtext bleibt lokal: waehrend des Tippens ist das JSON regelmaessig unparsierbar; nach
// oben gemeldet wird nur ein geparster Wert.
import { useState } from 'react';
import type { EinstellungsBefund } from './verwende-einstellungen.js';
import { alsText, ausText } from './json-reiter-logik.js';
import { Hinweis } from '../ui/hinweis.js';

export interface JsonReiterProps {
  readonly wert: Readonly<Record<string, unknown>>;
  readonly aendere: (naechster: Record<string, unknown>) => void;
  readonly schreibbar: boolean;
  readonly befunde: readonly EinstellungsBefund[];
}

export function JsonReiter({ wert, aendere, schreibbar, befunde }: JsonReiterProps) {
  const [rohtext, setRohtext] = useState(() => alsText(wert));
  const [parseFehler, setParseFehler] = useState<string | undefined>(undefined);

  function beiEingabe(neuerRohtext: string) {
    setRohtext(neuerRohtext);
    const ergebnis = ausText(neuerRohtext);
    if (ergebnis.ok) {
      setParseFehler(undefined);
      aendere(ergebnis.wert);
    } else {
      setParseFehler(ergebnis.text);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        className="min-h-64 w-full rounded-md border border-border bg-background px-3 py-2 font-mono
          text-sm shadow-sm transition-colors focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed
          disabled:opacity-50"
        value={rohtext}
        readOnly={!schreibbar}
        onChange={(ereignis) => beiEingabe(ereignis.target.value)}
        spellCheck={false}
      />
      {parseFehler !== undefined && <Hinweis art="fehler">{parseFehler}</Hinweis>}
      {befunde.map((befund, index) => (
        <Hinweis key={`${befund.pfad}-${index}`} art="fehler">{befund.text}</Hinweis>
      ))}
    </div>
  );
}
