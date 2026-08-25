'use client';

/**
 * Aufwandfaktoren-Formular der Detailseite (Design-Spec §6.3): datengetrieben aus
 * `baueFaktorformular(konfiguration).felder` erzeugt, keine feste Faktorliste im Code.
 * Ein hier aufgezaehlter Faktorbezeichner waere genau die Codeaenderung, die die
 * Null-Dateien-Messung aus §6.3 (ein neuer Faktor ohne Codeaenderung) ausschliessen
 * wuerde.
 *
 * Darunter die `anzeigeFaktoren`: sie werden nicht erfasst, sondern in der
 * Faktorermittlung (Lagescore/Ableitung) hergeleitet, darum reine Anzeige.
 */
import { useEffect, useState } from 'react';
import {
  pruefeFaktorwerte, type Feldbeschreibung, type Faktorformular,
} from '../../server/faktorformular.js';
import { entscheideZellenwert } from './zellen-logik.js';
import { Hinweis } from '../ui/hinweis.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select } from '../ui/select.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';

export interface AufwandfaktorenProps {
  readonly formular: Faktorformular;
  readonly werte: Readonly<Record<string, number>>;
  readonly aendere: (werte: Readonly<Record<string, number>>) => void;
}

/**
 * `Number('')` ist 0 und `Number.isFinite(0)` wahr — ein geleertes Feld wurde hier bisher
 * als erfasste Null gemeldet, und der Kern gewichtet eine Null bereitwillig. Dieselbe
 * Stelle, fuer die `entscheideZellenwert` geschrieben wurde (siehe zellen-logik.ts); die
 * Lehre stand bisher nur in der Datei, in der der Fehler gemeldet worden war.
 */
function meldeGueltige(entwurf: string, aendere: (wert: number) => void): void {
  const entscheid = entscheideZellenwert(entwurf);
  if (entscheid.art === 'uebernehmen') aendere(entscheid.wert);
}

function OrdinalFeld(
  { feld, wert, aendere }: {
    readonly feld: Feldbeschreibung;
    readonly wert: number | undefined;
    readonly aendere: (wert: number) => void;
  },
) {
  // Ein Select hat keinen Tipp-Zwischenzustand — anders als ZahlFeld unten braucht es
  // darum keinen lokalen Entwurf und bleibt bei `onChange`.
  return (
    <Select
      id={`faktor-${feld.faktorId}`}
      value={wert ?? ''}
      onChange={(e) => meldeGueltige(e.target.value, aendere)}
    >
      <option value="" disabled>Bitte auswählen</option>
      {feld.stufen?.map((stufe) => (
        <option key={stufe.wert} value={stufe.wert}>
          {`${stufe.wert} — ${stufe.bezeichnung}`}
        </option>
      ))}
    </Select>
  );
}

/**
 * Haelt den Eingabewert lokal und meldet ihn erst beim Verlassen des Feldes (Muster
 * `ZellenEingabe.tsx`). Ohne lokalen Zustand ist das Feld ueber `value={wert ?? ''}`
 * direkt vom Projektstand kontrolliert: Ein geleertes Feld meldet ueber `onChange` sofort
 * `entscheideZellenwert('')` -> `verwerfen`, nichts aendert sich am Projektstand, und die
 * Anzeige springt im selben Tastendruck auf den alten Wert zurueck — ein Feld liesse sich
 * so nie leeren, um eine neue Zahl zu tippen (docs/offene-punkte-projektansicht.md). Der
 * Abgleich per useEffect holt Aenderungen nach, die von aussen kommen (z. B. Formular-
 * Reset).
 */
function ZahlFeld(
  { feld, wert, aendere }: {
    readonly feld: Feldbeschreibung;
    readonly wert: number | undefined;
    readonly aendere: (wert: number) => void;
  },
) {
  const [entwurf, setzeEntwurf] = useState(wert === undefined ? '' : String(wert));
  useEffect(() => {
    setzeEntwurf(wert === undefined ? '' : String(wert));
  }, [wert]);

  return (
    <Input
      id={`faktor-${feld.faktorId}`}
      type="number"
      min={feld.untergrenze}
      max={feld.obergrenze}
      value={entwurf}
      onChange={(e) => setzeEntwurf(e.target.value)}
      onBlur={() => {
        const entscheid = entscheideZellenwert(entwurf);
        // Ein geleertes oder nicht parsierbares Feld verwirft statt eine Zahl zu
        // erfinden; der Entwurf springt auf den bisherigen (moeglicherweise weiterhin
        // fehlenden) Wert zurueck. `pruefeFaktorwerte` zeigt den fehlenden Pflichtwert
        // dann als Hinweis unter dem Feld.
        if (entscheid.art === 'verwerfen') {
          setzeEntwurf(wert === undefined ? '' : String(wert));
          return;
        }
        aendere(entscheid.wert);
      }}
    />
  );
}

export function Aufwandfaktoren({ formular, werte, aendere }: AufwandfaktorenProps) {
  function setzeWert(faktorId: string, wert: number) {
    aendere({ ...werte, [faktorId]: wert });
  }

  // `pruefeFaktorwerte` ist dieselbe reine Pruefung wie serverseitig vor der Berechnung
  // (server/faktorformular.ts) — hier client-seitig fuer die feldnahe Vorschau genutzt,
  // nicht als Ersatz fuer die serverseitige Validierung.
  const meldungen = pruefeFaktorwerte(formular, werte);
  function meldungFuer(faktorId: string): string | undefined {
    return meldungen.find((m) => m.feldpfad === `aufwandfaktoren.${faktorId}`)?.text;
  }

  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold">Aufwandfaktoren</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Erfasst die Aufwandfaktoren, aus denen der Aufwandindikator D und die Honorarrange
        abgeleitet werden.
      </p>
      {formular.felder.length === 0 ? (
        <p className="text-muted-foreground">Keine manuell zu erfassenden Aufwandfaktoren.</p>
      ) : (
        <div className="mb-6 flex flex-wrap gap-4">
          {formular.felder.map((feld) => (
            <div key={feld.faktorId} className="flex flex-col gap-1">
              <Label htmlFor={`faktor-${feld.faktorId}`}>{feld.beschriftung}</Label>
              {feld.eingabeform === 'ordinal' ? (
                <OrdinalFeld
                  feld={feld}
                  wert={werte[feld.faktorId]}
                  aendere={(wert) => setzeWert(feld.faktorId, wert)}
                />
              ) : (
                <ZahlFeld
                  feld={feld}
                  wert={werte[feld.faktorId]}
                  aendere={(wert) => setzeWert(feld.faktorId, wert)}
                />
              )}
              {meldungFuer(feld.faktorId) !== undefined && (
                <Hinweis art="fehler" className="max-w-xs">
                  {meldungFuer(feld.faktorId)}
                </Hinweis>
              )}
            </div>
          ))}
        </div>
      )}
      {formular.anzeigeFaktoren.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Quelle</TableHead>
              <TableHead>Quellschlüssel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formular.anzeigeFaktoren.map((f) => (
              <TableRow key={f.faktorId}>
                <TableCell>{f.beschriftung}</TableCell>
                <TableCell>{f.quelle}</TableCell>
                <TableCell>{f.quellSchluessel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
