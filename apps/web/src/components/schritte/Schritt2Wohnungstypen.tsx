'use client';

/**
 * Schritt 2: je vorkommender Zimmerzahl genau ein Wohnungstyp (US-02). Die zehn Felder
 * der repraesentativen Parametrisierung (E-28) werden aus `dossierDefaults` vorbelegt und
 * bleiben VOR dem Abruf aenderbar — nach dem Abruf entwertet eine Aenderung die
 * Bewertungen (I-24, siehe Ablaufzustand).
 */
import { FeldMeldung } from '../FeldMeldung.js';
import type { Feldmeldung } from '../../server/feldmeldungen.js';

export interface Schritt2Props {
  readonly wohnungstypen: readonly Record<string, unknown>[];
  readonly meldungen: readonly Feldmeldung[];
  readonly setze: (pfad: string, wert: unknown) => void;
  readonly ergaenze: () => void;
  readonly entferne: (index: number) => void;
}

/** Feldliste aus RepraesentativeParametrisierung; verbindlich und abschliessend (E-28). */
const PARAMETER: readonly (readonly [string, string, 'text' | 'number' | 'checkbox'])[] = [
  ['flaecheInnen', 'Wohnfläche (m²)', 'number'],
  ['flaecheAussen', 'Aussenfläche (m²)', 'number'],
  ['stockwerk', 'Stockwerk', 'number'],
  ['energielabel', 'Energielabel', 'text'],
  ['anzahlBadezimmer', 'Anzahl Badezimmer', 'number'],
  ['lift', 'Lift', 'checkbox'],
  ['baujahr', 'Baujahr', 'number'],
  ['heizungsart', 'Heizungsart', 'text'],
];

export function Schritt2Wohnungstypen(
  { wohnungstypen, meldungen, setze, ergaenze, entferne }: Schritt2Props,
) {
  return (
    <section>
      <h2>Wohnungstypen</h2>
      {wohnungstypen.length === 0 && (
        <p>Noch kein Wohnungstyp erfasst. Je vorkommender Zimmerzahl wird genau einer angelegt.</p>
      )}
      {wohnungstypen.map((typ, ti) => {
        const parametrisierung = (typ['parametrisierung'] ?? {}) as Record<string, unknown>;
        return (
          <fieldset key={String(typ['id'])}>
            <legend>{String(typ['zimmerzahl'])} Zimmer</legend>
            <div className="feld">
              <label htmlFor={`zimmerzahl-${ti}`}>Zimmeranzahl</label>
              <input id={`zimmerzahl-${ti}`} type="number" step="0.5"
                     value={String(typ['zimmerzahl'] ?? '')}
                     onChange={(e) => setze(`wohnungstypen.${ti}.zimmerzahl`, Number(e.target.value))} />
              <FeldMeldung feldpfad={`wohnungstypen.${ti}.zimmerzahl`} meldungen={meldungen} />
            </div>
            {PARAMETER.map(([schluessel, beschriftung, art]) => {
              const pfad = `wohnungstypen.${ti}.parametrisierung.${schluessel}`;
              return (
                <div key={schluessel} className="feld">
                  <label htmlFor={pfad}>{beschriftung}</label>
                  {art === 'checkbox' ? (
                    <input id={pfad} type="checkbox" checked={parametrisierung[schluessel] === true}
                           onChange={(e) => setze(pfad, e.target.checked)} />
                  ) : (
                    <input id={pfad} type={art} value={String(parametrisierung[schluessel] ?? '')}
                           onChange={(e) => setze(
                             pfad, art === 'number' ? Number(e.target.value) : e.target.value)} />
                  )}
                  <FeldMeldung feldpfad={pfad} meldungen={meldungen} />
                </div>
              );
            })}
            <button type="button" onClick={() => entferne(ti)}>Wohnungstyp entfernen</button>
          </fieldset>
        );
      })}
      <button type="button" onClick={ergaenze}>Wohnungstyp hinzufügen</button>
    </section>
  );
}
