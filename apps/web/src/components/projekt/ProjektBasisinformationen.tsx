'use client';

/**
 * Merkmale, die fuer das GANZE Neubau-Projekt gelten und deshalb nicht je Referenzobjekt
 * erfasst werden (Rueckmeldung Auftraggeber): aktuell nur das Baujahr. Eine Aenderung
 * hier schreibt denselben Wert in JEDES vorhandene Referenzobjekt
 * (`ProjektAnsicht.tsx`, `parametrisierung.baujahr`) — dort steht das Feld weiterhin,
 * weil `RepraesentativeParametrisierung` (packages/core) es je Wohnungstyp an
 * PriceHubble sendet; dieser Block ist nur die EINE Erfassungsstelle dafuer statt eines
 * gleichen Felds in jedem Referenzobjekt. Neue Referenzobjekte (Anlegen-Dialog,
 * `Referenzobjekte.tsx`) uebernehmen `baujahr` ebenso, statt bei 0 zu beginnen.
 */
import { useEffect, useState } from 'react';
import { entscheideZellenwert } from './zellen-logik.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';

export interface ProjektBasisinformationenProps {
  readonly baujahr: number | undefined;
  readonly aendere: (baujahr: number) => void;
}

export function ProjektBasisinformationen({ baujahr, aendere }: ProjektBasisinformationenProps) {
  const [entwurf, setzeEntwurf] = useState(baujahr === undefined ? '' : String(baujahr));
  // Wie `ZellenEingabe`: von aussen kommende Aenderungen (Neuladen des Projekts) muessen
  // nachgezogen werden, sonst zeigte das Feld nach einem Blur einen veralteten Entwurf.
  useEffect(() => { setzeEntwurf(baujahr === undefined ? '' : String(baujahr)); }, [baujahr]);

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Basisinformationen</h2>
      <div className="flex max-w-32 flex-col gap-1.5">
        <Label htmlFor="projekt-baujahr">Baujahr</Label>
        <Input
          id="projekt-baujahr"
          type="number"
          value={entwurf}
          onChange={(e) => setzeEntwurf(e.target.value)}
          onBlur={() => {
            const entscheid = entscheideZellenwert(entwurf);
            // Ein geleertes oder nicht parsierbares Feld verwirft statt eine 0 zu
            // erfinden (gleiches Muster wie `ZellenEingabe`) — 0 waere hier zudem kein
            // plausibles Baujahr.
            if (entscheid.art === 'verwerfen') {
              setzeEntwurf(baujahr === undefined ? '' : String(baujahr));
              return;
            }
            aendere(entscheid.wert);
          }}
        />
      </div>
    </section>
  );
}
