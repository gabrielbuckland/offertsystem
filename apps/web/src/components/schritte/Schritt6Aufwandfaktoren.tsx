'use client';

/**
 * Erfassungsschritt der Aufwandfaktoren. Rendert ausschliesslich, was
 * `baueFaktorformular` beschreibt (E-24); ein neuer Faktor aendert die Konfiguration,
 * nicht diese Datei.
 *
 * Die schreibgeschuetzte Anzeige der uebrigen Faktoren macht dem Vermarkter erkennbar,
 * welche Groessen neben seinen eigenen Angaben in D eingehen — dieselbe
 * Transparenzbegruendung wie bei der Herkunftskennzeichnung.
 */
import { formatiereScore } from '@offert/offer';
import { FeldMeldung } from '../FeldMeldung.js';
import type { Faktorformular } from '../../server/faktorformular.js';
import type { Feldmeldung } from '../../server/feldmeldungen.js';

export interface Schritt6Props {
  readonly formular: Faktorformular;
  readonly werte: Readonly<Record<string, number | undefined>>;
  readonly rohwerte: Readonly<Record<string, number | undefined>>;
  readonly meldungen: readonly Feldmeldung[];
  readonly aendere: (faktorId: string, wert: number) => void;
}

export function Schritt6Aufwandfaktoren(
  { formular, werte, rohwerte, meldungen, aendere }: Schritt6Props,
) {
  return (
    <section>
      <h2>Aufwandfaktoren</h2>
      {formular.felder.map((feld) => (
        <div key={feld.faktorId} className="feld">
          <label htmlFor={feld.faktorId}>{feld.beschriftung}</label>
          {feld.eingabeform === 'ordinal' && feld.stufen !== undefined ? (
            <select id={feld.faktorId} value={werte[feld.faktorId] ?? ''}
                    onChange={(e) => aendere(feld.faktorId, Number(e.target.value))}>
              <option value="">bitte wählen</option>
              {feld.stufen.map((s) => (
                <option key={s.wert} value={s.wert}>{s.wert} — {s.bezeichnung}</option>
              ))}
            </select>
          ) : (
            <input id={feld.faktorId} type="number"
                   min={feld.untergrenze} max={feld.obergrenze}
                   value={werte[feld.faktorId] ?? ''}
                   onChange={(e) => aendere(feld.faktorId, Number(e.target.value))} />
          )}
          <FeldMeldung feldpfad={`aufwandfaktoren.${feld.faktorId}`} meldungen={meldungen} />
        </div>
      ))}

      <h3>Nicht erfasste Faktoren</h3>
      <table>
        <thead><tr><th>Faktor</th><th>Quelle</th><th>Rohwert</th></tr></thead>
        <tbody>
          {formular.anzeigeFaktoren.map((f) => {
            const rohwert = rohwerte[f.faktorId];
            return (
              <tr key={f.faktorId}>
                <td>{f.beschriftung}</td>
                <td>{f.quelle === 'lagescore'
                      ? `Lagescore ${f.quellSchluessel} (PriceHubble)`
                      : `abgeleitet aus ${f.quellSchluessel}`}</td>
                <td>{rohwert !== undefined ? formatiereScore(rohwert) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
