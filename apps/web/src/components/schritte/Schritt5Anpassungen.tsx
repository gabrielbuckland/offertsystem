'use client';

/**
 * Erfassungsschritt der Zu- und Abschlaege. Vorlagen erscheinen als Auswahl, nie als
 * Vorbelegung (E-25): Erst die Uebernahme durch den Vermarkter erzeugt eine Position.
 *
 * Jede Position traegt ihre eigene Begruendung und ihre eigene Feldmeldung; der Saldo
 * wird nicht anstelle der Einzelposten dargestellt (I-09, A-14).
 */
import { formatiereProzent } from '@offert/offer';
import { FeldMeldung } from '../FeldMeldung.js';
import type { Anpassungsvorlage } from '../../server/anpassungsvorlagen.js';
import type { Feldmeldung } from '../../server/feldmeldungen.js';

export interface AnpassungEingabe {
  readonly faktor: number;
  readonly begruendung: string;
}

export interface EinheitMitAnpassungen {
  readonly wohnungsnummer: string;
  readonly anpassungen: readonly AnpassungEingabe[];
}

export interface Schritt5Props {
  readonly einheiten: readonly EinheitMitAnpassungen[];
  readonly vorlagen: readonly Anpassungsvorlage[];
  readonly meldungen: readonly Feldmeldung[];
  readonly uebernimm: (einheitIndex: number, vorlageId: string) => void;
  readonly aendere: (
    einheitIndex: number, anpassungIndex: number, teil: Partial<AnpassungEingabe>,
  ) => void;
  readonly entferne: (einheitIndex: number, anpassungIndex: number) => void;
  readonly ergaenze: (einheitIndex: number) => void;
}

export function Schritt5Anpassungen(
  { einheiten, vorlagen, meldungen, uebernimm, aendere, entferne, ergaenze }: Schritt5Props,
) {
  return (
    <section>
      <h2>Zu- und Abschläge</h2>
      {einheiten.map((einheit, ei) => (
        <fieldset key={einheit.wohnungsnummer}>
          <legend>Einheit {einheit.wohnungsnummer}</legend>

          <label htmlFor={`vorlage-${ei}`}>Vorschläge aus den Company Defaults</label>
          <select id={`vorlage-${ei}`} defaultValue=""
                  onChange={(e) => { if (e.target.value !== '') uebernimm(ei, e.target.value); }}>
            <option value="">Vorlage übernehmen …</option>
            {vorlagen.map((v) => (
              <option key={v.id} value={v.id}>
                {v.bezeichnung} ({formatiereProzent(v.vorgabefaktor)})
              </option>
            ))}
          </select>

          <ol>
            {einheit.anpassungen.map((a, ai) => (
              <li key={`${einheit.wohnungsnummer}-${ai}`}>
                <input type="number" step="0.001" value={a.faktor}
                       onChange={(e) => aendere(ei, ai, { faktor: Number(e.target.value) })} />
                <textarea value={a.begruendung} required
                          onChange={(e) => aendere(ei, ai, { begruendung: e.target.value })} />
                <button type="button" className="bedienelement"
                        onClick={() => entferne(ei, ai)}>entfernen</button>
                <FeldMeldung feldpfad={`einheiten.${ei}.anpassungen.${ai}.begruendung`}
                             meldungen={meldungen} />
              </li>
            ))}
          </ol>

          <button type="button" className="bedienelement" onClick={() => ergaenze(ei)}>
            Position ohne Vorlage ergänzen
          </button>
          <FeldMeldung feldpfad={`einheiten.${ei}.anpassungen`} meldungen={meldungen} />
        </fieldset>
      ))}
    </section>
  );
}
