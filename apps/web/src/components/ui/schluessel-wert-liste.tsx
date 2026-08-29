'use client';

/**
 * Generische Schluessel-Wert-Liste mit Hinzufuegen/Entfernen/Bearbeiten fuer offene
 * Records (Zod `z.record(z.string())`), deren Zeilenzahl nicht feststeht — z. B.
 * `zustandsbewertungen`/`qualitaetsbewertungen` in `Referenzobjekt['parametrisierung']`
 * und in `DossierDefaults`. Eine bestehende Zeile bleibt am Schluessel fixiert, ihr Wert
 * laesst sich direkt bearbeiten; die Neu-Zeile nimmt Schluessel UND Wert gemeinsam
 * entgegen. Kennt keine Domaenenbegriffe, bleibt generisch ueber den uebergebenen Record.
 */
import { Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Button } from './button.js';
import { Input } from './input.js';
import {
  naechsteEintraegeNachEntfernen,
  naechsteEintraegeNachHinzufuegen,
  naechsteEintraegeNachWertaenderung,
} from './schluessel-wert-logik.js';

export interface SchluesselWertListeProps {
  readonly eintraege: Readonly<Record<string, string>>;
  readonly aendere: (naechste: Readonly<Record<string, string>>) => void;
}

export function SchluesselWertListe(
  { eintraege, aendere }: SchluesselWertListeProps,
): ReactElement {
  const [neuerSchluessel, setzeNeuenSchluessel] = useState('');
  const [neuerWert, setzeNeuenWert] = useState('');

  // Die drei Entscheidungen stehen als reine, getestete Funktionen daneben.
  function aendereWert(schluessel: string, wert: string): void {
    aendere(naechsteEintraegeNachWertaenderung(eintraege, schluessel, wert));
  }

  function entferneEintrag(schluessel: string): void {
    aendere(naechsteEintraegeNachEntfernen(eintraege, schluessel));
  }

  function fuegeEintragHinzu(): void {
    const naechste = naechsteEintraegeNachHinzufuegen(eintraege, neuerSchluessel, neuerWert);
    if (naechste === undefined) return;
    aendere(naechste);
    setzeNeuenSchluessel('');
    setzeNeuenWert('');
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="entfernen"
            onClick={() => entferneEintrag(schluessel)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={neuerSchluessel}
          onChange={(e) => setzeNeuenSchluessel(e.target.value)}
          className="h-8 w-1/3"
          placeholder="Schlüssel"
        />
        <Input
          value={neuerWert}
          onChange={(e) => setzeNeuenWert(e.target.value)}
          className="h-8 flex-1"
          placeholder="Wert"
        />
        <Button type="button" variant="outline" size="sm" onClick={fuegeEintragHinzu}>
          Eintrag hinzufügen
        </Button>
      </div>
    </div>
  );
}
