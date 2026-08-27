'use client';

/**
 * Merkmale, die fuer das GANZE Neubau-Projekt gelten und deshalb nicht je Referenzobjekt
 * erfasst werden (Rueckmeldung Auftraggeber): aktuell Baujahr und Auftraggeber. Eine
 * Aenderung des Baujahrs hier schreibt denselben Wert in JEDES vorhandene Referenzobjekt
 * (`ProjektAnsicht.tsx`, `parametrisierung.baujahr`) — dort steht das Feld weiterhin,
 * weil `RepraesentativeParametrisierung` (packages/core) es je Wohnungstyp an
 * PriceHubble sendet; dieser Block ist nur die EINE Erfassungsstelle dafuer statt eines
 * gleichen Felds in jedem Referenzobjekt. Neue Referenzobjekte (Anlegen-Dialog,
 * `Referenzobjekte.tsx`) uebernehmen `baujahr` ebenso, statt bei 0 zu beginnen.
 *
 * `auftraggeber` (Spec 2026-08-27 §1) sitzt hier mit, weil er wie das Baujahr ein
 * Merkmal des GANZEN Projekts ist, nicht eines Referenzobjekts oder einer Einheit —
 * Erfassungsstelle des Empfaengers, den der Platzhalter `{auftraggeber}` (Task 2)
 * im Offerttext auffuellt.
 *
 * Der Projektstand lebt genau einmal (`verwendeProjekt`) — jeder Block aendert nur
 * seinen Ausschnitt und ruft dafuer `aendere` mit dem VOLLEN Projekt auf, damit die
 * Persistenz an einer einzigen Stelle (PUT) bleibt.
 */
import { useEffect, useState } from 'react';
import { entscheideZellenwert } from './zellen-logik.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';

export interface ProjektBasisinformationenProps {
  readonly baujahr: number | undefined;
  readonly aendere: (baujahr: number) => void;
  readonly auftraggeber: string | undefined;
  readonly aendereAuftraggeber: (wert: string | undefined) => void;
}

export function ProjektBasisinformationen(
  { baujahr, aendere, auftraggeber, aendereAuftraggeber }: ProjektBasisinformationenProps,
) {
  const [entwurf, setzeEntwurf] = useState(baujahr === undefined ? '' : String(baujahr));
  // Wie `ZellenEingabe`: von aussen kommende Aenderungen (Neuladen des Projekts) muessen
  // nachgezogen werden, sonst zeigte das Feld nach einem Blur einen veralteten Entwurf.
  useEffect(() => { setzeEntwurf(baujahr === undefined ? '' : String(baujahr)); }, [baujahr]);

  const [auftraggeberEntwurf, setzeAuftraggeberEntwurf] = useState(auftraggeber ?? '');
  useEffect(() => { setzeAuftraggeberEntwurf(auftraggeber ?? ''); }, [auftraggeber]);

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Basisinformationen</h2>
      <div className="flex flex-wrap gap-6">
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
        <div className="flex max-w-md flex-1 flex-col gap-1.5">
          <Label htmlFor="projekt-auftraggeber">Auftraggeber</Label>
          <Input
            id="projekt-auftraggeber"
            type="text"
            value={auftraggeberEntwurf}
            onChange={(e) => setzeAuftraggeberEntwurf(e.target.value)}
            onBlur={() => {
              const wert = auftraggeberEntwurf.trim();
              aendereAuftraggeber(wert === '' ? undefined : wert);
            }}
          />
        </div>
      </div>
    </section>
  );
}
