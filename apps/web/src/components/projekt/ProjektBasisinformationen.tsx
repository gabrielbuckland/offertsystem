'use client';

// Aenderung des Baujahrs schreibt denselben Wert in JEDES Referenzobjekt
// (parametrisierung.baujahr), da RepraesentativeParametrisierung (packages/core) es je
// Wohnungstyp an PriceHubble sendet; dies ist die einzige Erfassungsstelle dafuer.
import { useEffect, useState } from 'react';
import { formatiereScore } from '@offert/offer';
import { entscheideZellenwert } from './zellen-logik.js';
import { AufwandindikatorSkala } from './AufwandindikatorSkala.js';
import { Hinweis } from '../ui/hinweis.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';

export interface ProjektBasisinformationenProps {
  readonly baujahr: number | undefined;
  readonly aendere: (baujahr: number) => void;
  readonly auftraggeber: string | undefined;
  readonly aendereAuftraggeber: (wert: string | undefined) => void;
  readonly aufwandindikator: number | undefined;
  // Fehlt, solange noch keine Berechnung gelaufen ist.
  readonly aufwandindikatorVorschlag: number | undefined;
  // undefined loescht die Uebersteuerung; danach gilt wieder die Ableitung.
  readonly aendereAufwandindikator: (wert: number | undefined) => void;
}

export type AufwandindikatorEntscheid =
  | { readonly art: 'uebernehmen'; readonly wert: number }
  | { readonly art: 'loeschen' }
  | { readonly art: 'verwerfen' };

// Geleertes Feld LOESCHT die Uebersteuerung (Rueckkehr zur Ableitung) — anders als bei
// den Zahlfeldern ist Leeren hier eine gueltige Absicht, kein Tippzwischenstand.
export function entscheideAufwandindikator(entwurf: string): AufwandindikatorEntscheid {
  if (entwurf.trim() === '') return { art: 'loeschen' };
  const entscheid = entscheideZellenwert(entwurf);
  if (entscheid.art === 'verwerfen') return { art: 'verwerfen' };
  if (entscheid.wert < 0 || entscheid.wert > 1) return { art: 'verwerfen' };
  return { art: 'uebernehmen', wert: entscheid.wert };
}

export function ProjektBasisinformationen(
  {
    baujahr, aendere, auftraggeber, aendereAuftraggeber,
    aufwandindikator, aufwandindikatorVorschlag, aendereAufwandindikator,
  }: ProjektBasisinformationenProps,
) {
  const [entwurf, setzeEntwurf] = useState(baujahr === undefined ? '' : String(baujahr));
  // Wie ZellenEingabe: von aussen kommende Aenderungen nachziehen, sonst zeigt das Feld
  // nach einem Blur einen veralteten Entwurf.
  useEffect(() => { setzeEntwurf(baujahr === undefined ? '' : String(baujahr)); }, [baujahr]);

  const [auftraggeberEntwurf, setzeAuftraggeberEntwurf] = useState(auftraggeber ?? '');
  useEffect(() => { setzeAuftraggeberEntwurf(auftraggeber ?? ''); }, [auftraggeber]);

  const [dEntwurf, setzeDEntwurf] = useState(
    aufwandindikator === undefined ? '' : String(aufwandindikator));
  useEffect(() => {
    setzeDEntwurf(aufwandindikator === undefined ? '' : String(aufwandindikator));
  }, [aufwandindikator]);
  const [dVerworfen, setzeDVerworfen] = useState(false);
  // Vorrang wie in wirksamer-wert.ts / Aggregatleiste: Uebersteuerung vor Ableitung.
  const effektiverAufwandindikator = aufwandindikator ?? aufwandindikatorVorschlag;

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
        <div className="flex max-w-56 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="projekt-aufwandindikator">Aufwandindikator D</Label>
            {aufwandindikator !== undefined && (
              <button
                type="button"
                className="text-xs underline"
                onClick={() => { setzeDVerworfen(false); aendereAufwandindikator(undefined); }}
              >
                Auf Ableitung zurücksetzen
              </button>
            )}
          </div>
          <Input
            id="projekt-aufwandindikator"
            type="number"
            min={0}
            max={1}
            step={0.01}
            placeholder={aufwandindikatorVorschlag === undefined
              ? '—' : formatiereScore(aufwandindikatorVorschlag)}
            value={dEntwurf}
            onChange={(e) => setzeDEntwurf(e.target.value)}
            onBlur={() => {
              const entscheid = entscheideAufwandindikator(dEntwurf);
              if (entscheid.art === 'verwerfen') {
                setzeDVerworfen(true);
                setzeDEntwurf(aufwandindikator === undefined ? '' : String(aufwandindikator));
                return;
              }
              setzeDVerworfen(false);
              aendereAufwandindikator(entscheid.art === 'loeschen' ? undefined : entscheid.wert);
            }}
          />
          {effektiverAufwandindikator === undefined ? (
            <p className="text-xs text-muted-foreground">
              Abgeleitet aus PriceHubble-Lagescore und Projektdaten, zum Übersteuern
              Wert eintragen.
            </p>
          ) : (
            <>
              <AufwandindikatorSkala wert={effektiverAufwandindikator} />
              {aufwandindikator !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Übersteuert. Ableitung: {aufwandindikatorVorschlag === undefined
                    ? '—' : formatiereScore(aufwandindikatorVorschlag)}
                </p>
              )}
            </>
          )}
          {dVerworfen && (
            <Hinweis art="fehler" className="max-w-56">
              Wert muss zwischen 0 und 1 liegen.
            </Hinweis>
          )}
        </div>
      </div>
    </section>
  );
}
