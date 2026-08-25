'use client';

/**
 * Generische Schluessel-Wert-Liste mit Hinzufuegen/Entfernen/Bearbeiten fuer offene
 * Records (Zod `z.record(z.string())`), deren Zeilenzahl nicht feststeht — z. B.
 * `zustandsbewertungen`/`qualitaetsbewertungen` in `Referenzobjekt['parametrisierung']`
 * und in `DossierDefaults`. Bis Task 19 existierte diese Logik zweifach: als
 * `BewertungsTabelle` in `ParametrisierungsDetail.tsx` (Team A) und als `KeyWertListe` in
 * `DossierEditor.tsx` (Team B), unabhaengig voneinander entwickelt. Diese Fassung
 * vereint beide Interaktionsmuster: eine bestehende Zeile bleibt am Schluessel fixiert,
 * ihr Wert laesst sich aber direkt bearbeiten (Team B), waehrend die Neu-Zeile Schluessel
 * UND Wert gemeinsam entgegennimmt (Team A) — kein Feature einer der Vorlagen geht
 * verloren. Die Komponente kennt keine Domaenenbegriffe (kein "Bewertung", kein
 * "Dossier"): sie bleibt generisch ueber den ihr uebergebenen Record, siehe Brief.
 */
import { useState, type ReactElement } from 'react';
import { Button } from './button.js';
import { Input } from './input.js';
import { naechsteEintraegeNachHinzufuegen } from './schluessel-wert-logik.js';

export interface SchluesselWertListeProps {
  readonly eintraege: Readonly<Record<string, string>>;
  readonly aendere: (naechste: Readonly<Record<string, string>>) => void;
}

export function SchluesselWertListe(
  { eintraege, aendere }: SchluesselWertListeProps,
): ReactElement {
  const [neuerSchluessel, setzeNeuenSchluessel] = useState('');
  const [neuerWert, setzeNeuenWert] = useState('');

  function aendereWert(schluessel: string, wert: string): void {
    aendere({ ...eintraege, [schluessel]: wert });
  }

  function entferneEintrag(schluessel: string): void {
    const { [schluessel]: _entfernt, ...rest } = eintraege;
    aendere(rest);
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
          <Button type="button" variant="outline" size="sm" onClick={() => entferneEintrag(schluessel)}>
            entfernen
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
