'use client';

/** Schritt 1: Kundendaten und Liegenschaftsstammdaten. Jedes Feld traegt seine Meldung. */
import { FeldMeldung } from '../FeldMeldung.js';
import type { Feldmeldung } from '../../server/feldmeldungen.js';

export interface Schritt1Props {
  readonly kunde: Record<string, unknown>;
  readonly liegenschaft: Record<string, unknown>;
  readonly meldungen: readonly Feldmeldung[];
  readonly setze: (pfad: string, wert: unknown) => void;
}

interface FeldZeile {
  readonly pfad: string;
  readonly beschriftung: string;
  readonly art: 'text' | 'number';
}

const ZEILEN: readonly FeldZeile[] = [
  { pfad: 'kunde.name', beschriftung: 'Kunde', art: 'text' },
  { pfad: 'kunde.referenznummer', beschriftung: 'Referenznummer', art: 'text' },
  { pfad: 'liegenschaft.adresse.strasse', beschriftung: 'Strasse', art: 'text' },
  { pfad: 'liegenschaft.adresse.hausnummer', beschriftung: 'Hausnummer', art: 'text' },
  { pfad: 'liegenschaft.adresse.plz', beschriftung: 'Postleitzahl', art: 'text' },
  { pfad: 'liegenschaft.adresse.ort', beschriftung: 'Ort', art: 'text' },
  { pfad: 'liegenschaft.baujahr', beschriftung: 'Baujahr', art: 'number' },
  { pfad: 'liegenschaft.grundstuecksflaeche', beschriftung: 'Grundstücksfläche (m²)', art: 'number' },
];

function leseAmPfad(wurzel: Record<string, unknown>, pfad: readonly string[]): unknown {
  let knoten: unknown = wurzel;
  for (const teil of pfad) {
    if (typeof knoten !== 'object' || knoten === null) return undefined;
    knoten = (knoten as Record<string, unknown>)[teil];
  }
  return knoten;
}

export function Schritt1Liegenschaft({ kunde, liegenschaft, meldungen, setze }: Schritt1Props) {
  const wurzel: Record<string, unknown> = { kunde, liegenschaft };
  return (
    <section>
      <h2>Liegenschaftsdaten</h2>
      {ZEILEN.map((zeile) => (
        <div key={zeile.pfad} className="feld">
          <label htmlFor={zeile.pfad}>{zeile.beschriftung}</label>
          <input id={zeile.pfad} type={zeile.art}
                 value={String(leseAmPfad(wurzel, zeile.pfad.split('.')) ?? '')}
                 onChange={(e) => setze(
                   zeile.pfad,
                   zeile.art === 'number' ? Number(e.target.value) : e.target.value,
                 )} />
          <FeldMeldung feldpfad={zeile.pfad} meldungen={meldungen} />
        </div>
      ))}
    </section>
  );
}
