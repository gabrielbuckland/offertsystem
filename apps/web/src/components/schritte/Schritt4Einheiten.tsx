'use client';

/** Schritt 4: Einheiten, dynamisch ergaenzbar und entfernbar. */
import { FeldMeldung } from '../FeldMeldung.js';
import type { Feldmeldung } from '../../server/feldmeldungen.js';

export interface Schritt4Props {
  readonly einheiten: readonly Record<string, unknown>[];
  readonly wohnungstypen: readonly Record<string, unknown>[];
  readonly meldungen: readonly Feldmeldung[];
  readonly setze: (pfad: string, wert: unknown) => void;
  readonly ergaenze: () => void;
  readonly entferne: (index: number) => void;
}

const FELDER: readonly (readonly [string, string, 'text' | 'number'])[] = [
  ['wohnungsnummer', 'Wohnungsnummer', 'text'],
  ['flaecheInnen', 'Innenfläche (m²)', 'number'],
  ['flaecheAussen', 'Aussenfläche (m²)', 'number'],
  ['stockwerk', 'Stockwerk', 'number'],
  ['parkplaetze', 'Parkplätze', 'number'],
];

export function Schritt4Einheiten(
  { einheiten, wohnungstypen, meldungen, setze, ergaenze, entferne }: Schritt4Props,
) {
  return (
    <section>
      <h2>Einheiten</h2>
      {einheiten.map((einheit, ei) => (
        <fieldset key={`einheit-${ei}`}>
          <legend>Einheit {ei + 1}</legend>
          {FELDER.map(([schluessel, beschriftung, art]) => {
            const pfad = `einheiten.${ei}.${schluessel}`;
            return (
              <div key={schluessel} className="feld">
                <label htmlFor={pfad}>{beschriftung}</label>
                <input id={pfad} type={art} value={String(einheit[schluessel] ?? '')}
                       onChange={(e) => setze(
                         pfad, art === 'number' ? Number(e.target.value) : e.target.value)} />
                <FeldMeldung feldpfad={pfad} meldungen={meldungen} />
              </div>
            );
          })}
          <div className="feld">
            <label htmlFor={`einheiten.${ei}.wohnungstypId`}>Wohnungstyp</label>
            <select id={`einheiten.${ei}.wohnungstypId`}
                    value={String(einheit['wohnungstypId'] ?? '')}
                    onChange={(e) => setze(`einheiten.${ei}.wohnungstypId`, e.target.value)}>
              <option value="">bitte wählen</option>
              {wohnungstypen.map((t) => (
                <option key={String(t['id'])} value={String(t['id'])}>
                  {String(t['zimmerzahl'])} Zimmer
                </option>
              ))}
            </select>
            <FeldMeldung feldpfad={`einheiten.${ei}.wohnungstypId`} meldungen={meldungen} />
          </div>
          <button type="button" className="bedienelement" onClick={() => entferne(ei)}>
            Einheit entfernen
          </button>
        </fieldset>
      ))}
      <button type="button" className="bedienelement" onClick={ergaenze}>
        Einheit ergänzen
      </button>
    </section>
  );
}
