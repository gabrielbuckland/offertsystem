'use client';

/**
 * Aufklappbare Detailzeile je Referenzobjekt (Design-Spec §4/§5): die vollstaendige
 * Parametrisierung, statt nur der drei typbestimmenden Merkmale in der Hauptzeile
 * (`Referenzobjekte.tsx`). Jedes Skalarfeld traegt eine Herkunftsauszeichnung, damit
 * sichtbar bleibt, ob ein Wert vom firmenweiten Dossier-Default stammt oder projektbezogen
 * ueberschrieben wurde (Spec §5) — ohne sie liesse sich eine versehentliche Abweichung vom
 * Standard nicht von einer bewussten unterscheiden.
 */
import { useEffect, useState } from 'react';
import type { DossierDefaults } from '@offert/core';
import type { Referenzobjekt } from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { ZellenEingabe } from './ZellenEingabe.js';

type Parametrisierung = Referenzobjekt['parametrisierung'];
type Bewertungsrecord = 'zustandsbewertungen' | 'qualitaetsbewertungen';

export interface ParametrisierungsDetailProps {
  readonly parametrisierung: Parametrisierung;
  readonly dossierDefaults: DossierDefaults;
  readonly aendere: (patch: Partial<Parametrisierung>) => void;
}

/** Woertlich aus dem Task-Brief uebernommen (Step 3): `?? null` behandelt die vier
 *  Felder ohne firmenweiten Default (Schema `DossierDefaultsSchema`) gleich wie ein
 *  ausdruecklich auf `null` gesetztes Feld — beides ist "kein firmenweiter Wert". */
function herkunft(feld: string, wert: unknown, defaults: Readonly<Record<string, unknown>>) {
  return Object.is(defaults[feld] ?? null, wert) ? 'firmenweit' : 'projektbezogen';
}

function Herkunftsmarke({ feld, wert, defaults }: {
  readonly feld: string;
  readonly wert: unknown;
  readonly defaults: Readonly<Record<string, unknown>>;
}) {
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      {herkunft(feld, wert, defaults)}
    </span>
  );
}

/** Textfeld mit Entwurfslogik wie `ZellenEingabe`: lokal halten, erst bei `onBlur`
 *  melden — sonst schriebe jeder Tastendruck in den Projektstand (siehe dort). */
function TextfeldEntwurf({ wert, aendere }: {
  readonly wert: string;
  readonly aendere: (wert: string) => void;
}) {
  const [entwurf, setzeEntwurf] = useState(wert);
  // Wie `ZellenEingabe`: von aussen kommende Aenderungen (z. B. nach dem Einheitengenerator
  // oder einer Autosave-Rundfahrt) muessen nachgezogen werden, sonst zeigte das Feld nach
  // dem Blur eines anderen Feldes einen veralteten Entwurf.
  useEffect(() => { setzeEntwurf(wert); }, [wert]);
  return (
    <Input
      type="text"
      className="h-8 w-full"
      value={entwurf}
      onChange={(e) => setzeEntwurf(e.target.value)}
      onBlur={() => aendere(entwurf)}
    />
  );
}

/** Mini-Tabelle Schluessel/Wert fuer `zustandsbewertungen`/`qualitaetsbewertungen`: beide
 *  sind offene Records (Zod `z.record(z.string())`), die Oberflaeche kann die moeglichen
 *  Schluessel deshalb nicht vorab auflisten. */
function BewertungsTabelle({ titel, werte, aendere }: {
  readonly titel: string;
  readonly werte: Readonly<Record<string, string>>;
  readonly aendere: (werte: Record<string, string>) => void;
}) {
  const [neuerSchluessel, setzeNeuenSchluessel] = useState('');
  const [neuerWert, setzeNeuenWert] = useState('');

  function uebernehmen() {
    const schluessel = neuerSchluessel.trim();
    if (schluessel === '') return;
    aendere({ ...werte, [schluessel]: neuerWert });
    setzeNeuenSchluessel('');
    setzeNeuenWert('');
  }

  function entfernen(schluessel: string) {
    const rest = { ...werte };
    delete rest[schluessel];
    aendere(rest);
  }

  return (
    <div>
      <h4 className="mb-1 text-sm font-medium">{titel}</h4>
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(werte).map(([schluessel, wert]) => (
            <tr key={schluessel}>
              <td className="py-1 pr-2">{schluessel}</td>
              <td className="py-1 pr-2">{wert}</td>
              <td className="py-1">
                <Button type="button" variant="ghost" onClick={() => entfernen(schluessel)}>
                  entfernen
                </Button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-1 pr-2">
              <Input type="text" className="h-8 w-full" value={neuerSchluessel}
                     onChange={(e) => setzeNeuenSchluessel(e.target.value)} />
            </td>
            <td className="py-1 pr-2">
              <Input type="text" className="h-8 w-full" value={neuerWert}
                     onChange={(e) => setzeNeuenWert(e.target.value)} />
            </td>
            <td className="py-1">
              <Button type="button" variant="outline" onClick={uebernehmen}>
                Eintrag hinzufügen
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ParametrisierungsDetail(
  { parametrisierung: p, dossierDefaults, aendere }: ParametrisierungsDetailProps,
) {
  const defaults = dossierDefaults as unknown as Readonly<Record<string, unknown>>;

  function aendereRecord(feld: Bewertungsrecord, werte: Record<string, string>) {
    aendere({ [feld]: werte } as Partial<Parametrisierung>);
  }

  return (
    <div className="grid gap-4 p-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Wohnfläche (m²)</label>
          <ZellenEingabe wert={p.flaecheInnen}
                         aendere={(flaecheInnen) => aendere({ flaecheInnen })} />
          <Herkunftsmarke feld="flaecheInnen" wert={p.flaecheInnen} defaults={defaults} />
        </div>
        <div>
          <label className="text-sm font-medium">Aussenfläche (m²)</label>
          <ZellenEingabe wert={p.flaecheAussen}
                         aendere={(flaecheAussen) => aendere({ flaecheAussen })} />
          <Herkunftsmarke feld="flaecheAussen" wert={p.flaecheAussen} defaults={defaults} />
        </div>
        <div>
          <label className="text-sm font-medium">Stockwerk</label>
          <ZellenEingabe wert={p.stockwerk}
                         aendere={(stockwerk) => aendere({ stockwerk })} />
          <Herkunftsmarke feld="stockwerk" wert={p.stockwerk} defaults={defaults} />
        </div>
        <div>
          <label className="text-sm font-medium">Energielabel</label>
          <TextfeldEntwurf wert={p.energielabel}
                           aendere={(energielabel) => aendere({ energielabel })} />
          <Herkunftsmarke feld="energielabel" wert={p.energielabel} defaults={defaults} />
        </div>
        <div>
          <label className="text-sm font-medium">Anzahl Badezimmer</label>
          <ZellenEingabe wert={p.anzahlBadezimmer}
                         aendere={(anzahlBadezimmer) => aendere({ anzahlBadezimmer })} />
          <Herkunftsmarke feld="anzahlBadezimmer" wert={p.anzahlBadezimmer} defaults={defaults} />
        </div>
        <div>
          <label className="text-sm font-medium">Lift</label>
          <Select className="h-8" value={p.lift ? 'ja' : 'nein'}
                  onChange={(e) => aendere({ lift: e.target.value === 'ja' })}>
            <option value="ja">ja</option>
            <option value="nein">nein</option>
          </Select>
          <Herkunftsmarke feld="lift" wert={p.lift} defaults={defaults} />
        </div>
        <div>
          <label className="text-sm font-medium">Baujahr</label>
          <ZellenEingabe wert={p.baujahr} aendere={(baujahr) => aendere({ baujahr })} />
          <Herkunftsmarke feld="baujahr" wert={p.baujahr} defaults={defaults} />
        </div>
        <div>
          <label className="text-sm font-medium">Heizungsart</label>
          <TextfeldEntwurf wert={p.heizungsart}
                           aendere={(heizungsart) => aendere({ heizungsart })} />
          <Herkunftsmarke feld="heizungsart" wert={p.heizungsart} defaults={defaults} />
        </div>
      </div>
      <BewertungsTabelle titel="Zustandsbewertungen" werte={p.zustandsbewertungen}
                          aendere={(werte) => aendereRecord('zustandsbewertungen', werte)} />
      <BewertungsTabelle titel="Qualitätsbewertungen" werte={p.qualitaetsbewertungen}
                          aendere={(werte) => aendereRecord('qualitaetsbewertungen', werte)} />
    </div>
  );
}
