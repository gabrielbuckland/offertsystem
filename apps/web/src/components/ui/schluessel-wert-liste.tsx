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
  /**
   * Blendet die Entfernen-Spalte aus und zeigt stattdessen `sperrgrund`. Gedacht fuer
   * Aufrufer, deren Speichermodell ein Entfernen nicht ausdruecken kann (das
   * projektbezogene Delta, siehe `Bearbeitungsebene`) — dort waere der Knopf ein stiller
   * No-Op. Die Komponente selbst entscheidet das nicht; sie kennt kein Speichermodell.
   */
  readonly entfernenGesperrt?: boolean | undefined;
  readonly sperrgrund?: string | undefined;
}

export function SchluesselWertListe(
  { eintraege, aendere, entfernenGesperrt = false, sperrgrund }: SchluesselWertListeProps,
): ReactElement {
  const [neuerSchluessel, setzeNeuenSchluessel] = useState('');
  const [neuerWert, setzeNeuenWert] = useState('');

  // Die drei Entscheidungen stehen als reine Funktionen daneben und sind dort direkt
  // getestet; hier bleibt nur die Verdrahtung ans Ereignis.
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
          {!entfernenGesperrt && (
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
          )}
        </div>
      ))}
      {entfernenGesperrt && sperrgrund !== undefined && (
        <p className="text-xs text-muted-foreground">{sperrgrund}</p>
      )}
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
