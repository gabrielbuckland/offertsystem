'use client';

/**
 * Editor fuer den Teilbaum `dossierDefaults` (Task 16) — firmenweite Voreinstellungen
 * fuer neue Projekte. Die drei Primitivfelder (`flaecheInnen`, `flaecheAussen`,
 * `stockwerk` numerisch; `energielabel` textuell) legen bei leerem Feld `null` ab —
 * «leer lassen = keine Voreinstellung» (Spec §6), kein erfundener Nullwert.
 *
 * `zustandsbewertungen`/`qualitaetsbewertungen` sind offene Schluessel-Wert-Listen
 * (`Record<string, string>`), deren Zeilenzahl nicht feststeht — dasselbe Muster wie
 * `ParametrisierungsDetail` (Task 10, `components/projekt/`): hier EIGENSTAENDIG
 * implementiert (keine gemeinsame Datei ueber die Team-A/B-Grenze hinweg), die
 * Duplikation ist laut Brief bewusst in Kauf genommen und wird in Task 19 aufgeloest.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { Button } from '../ui/button.js';
import { Hinweis } from '../ui/hinweis.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { befundeFuerPfad, type BereichsEditorProps } from './verwende-einstellungen.js';

/**
 * Feld mit lokalem Eingabepuffer (Muster `ZellenEingabe.tsx`): meldet erst beim
 * Verlassen des Felds, damit ein Tastendruck nicht bei jeder Ziffer den Entwurf
 * umschreibt. Anders als `ZellenEingabe`/`entscheideZellenwert` verwirft ein leeres
 * Feld hier NICHT (kein Zurueckspringen auf den alten Wert) — leer ist das gueltige
 * Zielergebnis "keine Voreinstellung" (`null`).
 */
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

function KeyWertListe({ eintraege, aendere }: {
  readonly eintraege: Readonly<Record<string, string>>;
  readonly aendere: (naechste: Readonly<Record<string, string>>) => void;
}): ReactElement {
  const [neuerSchluessel, setzeNeuerSchluessel] = useState('');

  function aendereWert(schluessel: string, wert: string): void {
    aendere({ ...eintraege, [schluessel]: wert });
  }

  function entferneEintrag(schluessel: string): void {
    const { [schluessel]: _entfernt, ...rest } = eintraege;
    aendere(rest);
  }

  function fuegeEintragHinzu(): void {
    const schluessel = neuerSchluessel.trim();
    if (schluessel.length === 0 || schluessel in eintraege) return;
    aendere({ ...eintraege, [schluessel]: '' });
    setzeNeuerSchluessel('');
  }

  return (
    <div className="space-y-2">
      {Object.entries(eintraege).map(([schluessel, wert]) => (
        <div key={schluessel} className="flex items-center gap-2">
          <Input value={schluessel} readOnly disabled className="h-8 w-1/3" />
          <Input
            value={wert}
            onChange={(e) => aendereWert(schluessel, e.target.value)}
            className="h-8 flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => entferneEintrag(schluessel)}>
            entfernen
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={neuerSchluessel}
          onChange={(e) => setzeNeuerSchluessel(e.target.value)}
          className="h-8 w-1/3"
          placeholder="Schlüssel"
        />
        <Button type="button" variant="outline" size="sm" onClick={fuegeEintragHinzu}>
          hinzufügen
        </Button>
      </div>
    </div>
  );
}

export function DossierEditor({ einstellungen }: BereichsEditorProps): ReactElement {
  const dossier = einstellungen.entwurf['dossierDefaults'] as DossierDefaultsRoh;

  function schreibeDossier(naechster: Partial<DossierDefaultsRoh>): void {
    einstellungen.aendere({
      ...einstellungen.entwurf,
      dossierDefaults: { ...dossier, ...naechster },
    });
  }

  // Leerer (getrimmter) Text legt `null` ab statt einer erfundenen 0 — dieselbe
  // Leer-heisst-fehlend-Regel wie bei `entscheideZellenwert`, hier aber bewusst OHNE
  // dessen "verwerfen bei ungueltig": ein Voreinstellungsfeld darf jederzeit auf
  // "keine Vorgabe" zurueckgesetzt werden.
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
          <KeyWertListe
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
