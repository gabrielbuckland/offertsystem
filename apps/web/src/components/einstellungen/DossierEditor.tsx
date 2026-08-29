'use client';

// Editor fuer den Teilbaum `dossierDefaults` — firmenweite Voreinstellungen fuer neue
// Projekte. Die Zahlen-/Textfelder legen bei leerem Feld `null` ab: «leer lassen = keine
// Voreinstellung» (Spec §6), kein erfundener Nullwert.
import { useEffect, useState, type ReactElement } from 'react';
import { Hinweis } from '../ui/hinweis.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { SchluesselWertListe } from '../ui/schluessel-wert-liste.js';
import { befundeFuerPfad, type BereichsEditorProps } from './verwende-einstellungen.js';

// Meldet erst beim Verlassen des Felds (Muster `ZellenEingabe.tsx`). Anders als
// `entscheideZellenwert` verwirft ein leeres Feld hier NICHT — leer ist das gueltige
// Zielergebnis "keine Voreinstellung" (`null`).
function NullbaresFeld({ wert, aendere, typ = 'text' }: {
  readonly wert: string;
  readonly aendere: (text: string) => void;
  readonly typ?: 'text' | 'number';
}): ReactElement {
  const [entwurf, setzeEntwurf] = useState(wert);
  useEffect(() => { setzeEntwurf(wert); }, [wert]);

  return (
    <Input
      type={typ}
      className="h-8 w-full"
      value={entwurf}
      onChange={(e) => setzeEntwurf(e.target.value)}
      onBlur={() => aendere(entwurf)}
      placeholder="keine Voreinstellung"
    />
  );
}

interface DossierDefaultsRoh {
  readonly flaecheInnen: number | null;
  readonly flaecheAussen: number | null;
  readonly stockwerk: number | null;
  readonly energielabel: string | null;
  readonly zustandsbewertungen: Readonly<Record<string, string>>;
  readonly qualitaetsbewertungen: Readonly<Record<string, string>>;
}

type ZahlenFeld = 'flaecheInnen' | 'flaecheAussen' | 'stockwerk';
type ListenFeld = 'zustandsbewertungen' | 'qualitaetsbewertungen';

const ZAHLEN_FELDER: ReadonlyArray<{ readonly feld: ZahlenFeld; readonly beschriftung: string }> = [
  { feld: 'flaecheInnen', beschriftung: 'Fläche innen (m²)' },
  { feld: 'flaecheAussen', beschriftung: 'Fläche aussen (m²)' },
  { feld: 'stockwerk', beschriftung: 'Stockwerk' },
];

const LISTEN_FELDER: ReadonlyArray<{ readonly feld: ListenFeld; readonly beschriftung: string }> = [
  { feld: 'zustandsbewertungen', beschriftung: 'Zustandsbewertungen' },
  { feld: 'qualitaetsbewertungen', beschriftung: 'Qualitätsbewertungen' },
];

export function DossierEditor({ einstellungen }: BereichsEditorProps): ReactElement {
  const dossier = einstellungen.entwurf['dossierDefaults'] as DossierDefaultsRoh;

  function schreibeDossier(naechster: Partial<DossierDefaultsRoh>): void {
    einstellungen.aendere({
      ...einstellungen.entwurf,
      dossierDefaults: { ...dossier, ...naechster },
    });
  }

  function aendereZahlenfeld(feld: ZahlenFeld, text: string): void {
    const getrimmt = text.trim();
    if (getrimmt.length === 0) { schreibeDossier({ [feld]: null }); return; }
    const zahl = Number(getrimmt);
    if (!Number.isFinite(zahl)) return;
    schreibeDossier({ [feld]: zahl });
  }

  function aendereEnergielabel(text: string): void {
    const getrimmt = text.trim();
    schreibeDossier({ energielabel: getrimmt.length === 0 ? null : getrimmt });
  }

  const dossierBefunde = befundeFuerPfad(einstellungen.befunde, 'dossierDefaults');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {ZAHLEN_FELDER.map(({ feld, beschriftung }) => (
          <div key={feld} className="space-y-1">
            <Label>{beschriftung}</Label>
            <NullbaresFeld
              typ="number"
              wert={dossier[feld] === null ? '' : String(dossier[feld])}
              aendere={(text) => aendereZahlenfeld(feld, text)}
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label>Energielabel</Label>
          <NullbaresFeld
            wert={dossier.energielabel ?? ''}
            aendere={aendereEnergielabel}
          />
        </div>
      </div>

      {LISTEN_FELDER.map(({ feld, beschriftung }) => (
        <div key={feld} className="space-y-2 rounded-md border border-border p-4">
          <h3 className="text-sm font-semibold">{beschriftung}</h3>
          <SchluesselWertListe
            eintraege={dossier[feld]}
            aendere={(naechste) => schreibeDossier({ [feld]: naechste })}
          />
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
