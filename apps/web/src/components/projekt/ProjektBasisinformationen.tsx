'use client';

/**
 * Merkmale, die fuer das GANZE Neubau-Projekt gelten und deshalb nicht je Referenzobjekt
 * erfasst werden (Rueckmeldung Auftraggeber): Baujahr, Auftraggeber und der
 * Aufwandindikator D. Eine Aenderung des Baujahrs hier schreibt denselben Wert in JEDES
 * vorhandene Referenzobjekt (`ProjektAnsicht.tsx`, `parametrisierung.baujahr`) — dort
 * steht das Feld weiterhin, weil `RepraesentativeParametrisierung` (packages/core) es je
 * Wohnungstyp an PriceHubble sendet; dieser Block ist nur die EINE Erfassungsstelle dafuer
 * statt eines gleichen Felds in jedem Referenzobjekt. Neue Referenzobjekte
 * (Anlegen-Dialog, `Referenzobjekte.tsx`) uebernehmen `baujahr` ebenso, statt bei 0 zu
 * beginnen.
 *
 * `auftraggeber` (Spec 2026-08-27 §1) sitzt hier mit, weil er wie das Baujahr ein
 * Merkmal des GANZEN Projekts ist, nicht eines Referenzobjekts oder einer Einheit —
 * Erfassungsstelle des Empfaengers, den der Platzhalter `{auftraggeber}` (Task 2)
 * im Offerttext auffuellt.
 *
 * Aufwandindikator D (Rueckmeldung Auftraggeber 2026-08-28): Das Feld zeigt den aus den
 * PriceHubble-Lagescores und den abgeleiteten Projektgroessen hergeleiteten Wert als
 * Vorschlag und laesst den Vermarkter ihn uebersteuern. Die Rangfolge ist dieselbe wie
 * bei den Zu-/Abschlagsspalten (`wirksamer-wert.ts`): Die ANWESENHEIT der Uebersteuerung
 * entscheidet — ein geleertes Feld kehrt zur Ableitung zurueck, statt eine Zahl zu
 * erfinden.
 *
 * Der Projektstand lebt genau einmal (`verwendeProjekt`) — jeder Block aendert nur
 * seinen Ausschnitt und ruft dafuer `aendere` mit dem VOLLEN Projekt auf, damit die
 * Persistenz an einer einzigen Stelle (PUT) bleibt.
 */
import { useEffect, useState } from 'react';
import { formatiereScore } from '@offert/offer/src/format/de-ch.js';
import { entscheideZellenwert } from './zellen-logik.js';
import { Hinweis } from '../ui/hinweis.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';

export interface ProjektBasisinformationenProps {
  readonly baujahr: number | undefined;
  readonly aendere: (baujahr: number) => void;
  readonly auftraggeber: string | undefined;
  readonly aendereAuftraggeber: (wert: string | undefined) => void;
  /** Uebersteuerter Aufwandindikator D des Projekts (`aufwandindikatorUebersteuerung`). */
  readonly aufwandindikator: number | undefined;
  /** Aus den Faktoren (Lagescore, abgeleitete Groessen) hergeleiteter D-Wert — fehlt,
   *  solange noch keine Berechnung gelaufen ist. */
  readonly aufwandindikatorVorschlag: number | undefined;
  /** `undefined` loescht die Uebersteuerung; danach gilt wieder die Ableitung. */
  readonly aendereAufwandindikator: (wert: number | undefined) => void;
}

export type AufwandindikatorEntscheid =
  | { readonly art: 'uebernehmen'; readonly wert: number }
  | { readonly art: 'loeschen' }
  | { readonly art: 'verwerfen' };

/**
 * Reine Commit-Entscheidung beim Verlassen des D-Felds (Muster `zellen-logik.ts`):
 * Ein geleertes Feld LOESCHT die Uebersteuerung (Rueckkehr zur Ableitung) — anders als
 * bei den Zahlfeldern ist Leeren hier eine gueltige Absicht, kein Tippzwischenstand.
 * Ein nicht parsierbarer oder ausserhalb [0,1] liegender Entwurf verwirft; das Schema
 * (`projekt-schema.ts`) wiese ihn ohnehin zurueck, dann aber erst beim Speichern.
 */
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
  // Wie `ZellenEingabe`: von aussen kommende Aenderungen (Neuladen des Projekts) muessen
  // nachgezogen werden, sonst zeigte das Feld nach einem Blur einen veralteten Entwurf.
  useEffect(() => { setzeEntwurf(baujahr === undefined ? '' : String(baujahr)); }, [baujahr]);

  const [auftraggeberEntwurf, setzeAuftraggeberEntwurf] = useState(auftraggeber ?? '');
  useEffect(() => { setzeAuftraggeberEntwurf(auftraggeber ?? ''); }, [auftraggeber]);

  const [dEntwurf, setzeDEntwurf] = useState(
    aufwandindikator === undefined ? '' : String(aufwandindikator));
  useEffect(() => {
    setzeDEntwurf(aufwandindikator === undefined ? '' : String(aufwandindikator));
  }, [aufwandindikator]);
  const [dVerworfen, setzeDVerworfen] = useState(false);

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
          <p className="text-xs text-muted-foreground">
            {aufwandindikator === undefined
              ? '0 steht für geringen, 1 für hohen Vermarktungsaufwand; der Wert skaliert '
                + 'die Honorarrange. Abgeleitet aus PriceHubble-Lagescore und Projektdaten, '
                + 'zum Übersteuern Wert eintragen.'
              : `Übersteuert. Ableitung: ${aufwandindikatorVorschlag === undefined
                ? '—' : formatiereScore(aufwandindikatorVorschlag)}`}
          </p>
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
