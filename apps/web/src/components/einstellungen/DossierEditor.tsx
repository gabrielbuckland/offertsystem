'use client';

import type { ReactElement } from 'react';
import { BEWERTUNGSFELDER } from '@offert/core';
import {
  BEWERTUNGSOBJEKTE, beschrifteFeld, type Bewertungsobjekt,
} from '../../lib/dossier-beschriftungen.js';
import { Hinweis } from '../ui/hinweis.js';
import { Label } from '../ui/label.js';
import { Select } from '../ui/select.js';
import { befundeFuerPfad, type BereichsEditorProps } from './verwende-einstellungen.js';

interface DossierDefaultsRoh {
  readonly zustandsbewertungen: Readonly<Record<string, string>>;
  readonly qualitaetsbewertungen: Readonly<Record<string, string>>;
}

type ListenFeld = keyof DossierDefaultsRoh;

const OBJEKTE: ReadonlyArray<readonly [ListenFeld, Bewertungsobjekt]> = [
  ['zustandsbewertungen', BEWERTUNGSOBJEKTE['zustandsbewertungen']!],
  ['qualitaetsbewertungen', BEWERTUNGSOBJEKTE['qualitaetsbewertungen']!],
];

export function DossierEditor({ einstellungen }: BereichsEditorProps): ReactElement {
  const dossier = einstellungen.entwurf['dossierDefaults'] as DossierDefaultsRoh;

  function schreibe(feld: ListenFeld, schluessel: string, wert: string): void {
    einstellungen.aendere({
      ...einstellungen.entwurf,
      dossierDefaults: {
        ...dossier,
        [feld]: { ...dossier[feld], [schluessel]: wert },
      },
    });
  }

  const dossierBefunde = befundeFuerPfad(einstellungen.befunde, 'dossierDefaults');

  return (
    <div className="space-y-6">
      {OBJEKTE.map(([feld, { beschriftung, werte, wertBeschriftung }]) => (
        <div key={feld} className="space-y-3 rounded-md border border-border p-4">
          <h3 className="text-sm font-semibold">{beschriftung}</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {BEWERTUNGSFELDER.map((schluessel) => (
              <div key={schluessel} className="space-y-1">
                <Label htmlFor={`${feld}-${schluessel}`}>
                  {beschrifteFeld(schluessel)}
                </Label>
                <Select
                  id={`${feld}-${schluessel}`}
                  className="h-8"
                  value={dossier[feld][schluessel] ?? werte[0]}
                  onChange={(e) => schreibe(feld, schluessel, e.target.value)}
                >
                  {werte.map((wert) => (
                    <option key={wert} value={wert}>{wertBeschriftung[wert]}</option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </div>
      ))}

      {dossierBefunde.length > 0 && (
        <div className="space-y-2">
          {dossierBefunde.map((befund, i) => (
            <Hinweis key={`${befund.pfad}-${i}`} art="fehler">{befund.text}</Hinweis>
          ))}
        </div>
      )}
    </div>
  );
}
