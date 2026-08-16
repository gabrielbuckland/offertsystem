'use client';

/**
 * Schritt 3: Bewertungsabruf. Die Angabe zur Abrufzahl macht die Abrufoekonomie
 * (NFA-12, I-27) in der Bedienung sichtbar — je Wohnungstyp eine Bewertung, unabhaengig
 * von der Anzahl Einheiten.
 */
import type { AngezeigterFehler } from '../../server/fehlertexte.js';
import type { AblaufZustand } from './ablauf-zustand.js';

export interface Schritt3Props {
  readonly zustand: AblaufZustand;
  readonly abrufFehler?: AngezeigterFehler | undefined;
  readonly rufeAb: () => void;
}

export function Schritt3Bewertungsabruf({ zustand, abrufFehler, rufeAb }: Schritt3Props) {
  return (
    <section>
      <h2>Bewertungsabruf</h2>
      <p>
        Es werden {zustand.wohnungstypen.length} Referenzbewertungen und einmalig die
        Lagescores der Projektadresse bezogen — je Wohnungstyp eine Bewertung, unabhängig
        von der Anzahl Einheiten (N = 2 + 2·T, I-27).
      </p>
      <button type="button" className="bedienelement" onClick={rufeAb}>
        Bewertungen beziehen
      </button>
      {abrufFehler !== undefined && (
        <p role="alert" className="fehler">{abrufFehler.text}</p>
      )}
      {zustand.bewertungen?.vollstaendig === false && (
        <p role="alert" className="fehler">
          Teilergebnis: Für einen Wohnungstyp liegt keine Bewertung vor. Es wird keine
          Berechnung ausgeführt.
        </p>
      )}
    </section>
  );
}
