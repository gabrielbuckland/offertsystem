'use client';

/**
 * Bearbeitet die Staffel einer Anpassungsvorlage. Die Anzeige folgt derselben Regel wie
 * `AnpassungsSpalten.tsx`: gezeigt und erfasst wird die Einheit, in der ein Mensch denkt
 * (Prozent bei 'relativ', Franken bei 'absolut'), abgelegt die des Kerns (Faktor bzw.
 * Rappen). Zwei verschiedene Skalen fuer dieselbe Groesse waren schon einmal der Fehler,
 * der den Faktor 100 verursacht hat.
 *
 * Der Restfall ist die letzte Zeile und traegt bewusst KEINE Schwelleneingabe: Er ist
 * das, was die Auswertung total macht, und darf nicht wegkonfiguriert werden.
 *
 * Typen kommen aus `@offert/core`, nicht aus `server/projekt-schema.js`: Dieser Editor
 * bearbeitet die firmenweite Konfiguration (`anpassungsVorlagen`/`merkmale` im Entwurf
 * von `verwendeEinstellungen`), nicht ein Projektartefakt. Beide Module fuehren einen
 * strukturell fast identischen Typ `Bereichsregel` — hier ist der aus dem Kern der
 * richtige, weil er exakt die Form ist, die `pruefeBereiche`/`werteBereichsregelAus`
 * (ebenfalls aus dem Kern) erwarten.
 */
import { Trash2 } from 'lucide-react';
import { pruefeBereiche, type Bereichsregel, type Merkmal } from '@offert/core';
import { Button } from '../ui/button.js';
import { Select } from '../ui/select.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { ZellenEingabe } from '../projekt/ZellenEingabe.js';
import {
  faktorZuProzent, frankenZuRappen, prozentZuFaktor, rappenZuFranken,
} from '../projekt/zellen-logik.js';

export interface BereichsregelEditorProps {
  readonly regel: Bereichsregel;
  readonly merkmale: readonly Merkmal[];
  readonly erfassungsform: 'relativ' | 'absolut';
  readonly aendere: (regel: Bereichsregel) => void;
}

export function BereichsregelEditor(
  { regel, merkmale, erfassungsform, aendere }: BereichsregelEditorProps,
) {
  const befunde = pruefeBereiche(regel.bereiche);
  const anzeige = (w: number) => (erfassungsform === 'relativ' ? faktorZuProzent(w) : rappenZuFranken(w));
  const ablage = (w: number) => (erfassungsform === 'relativ' ? prozentZuFaktor(w) : frankenZuRappen(w));

  function setzeBereich(index: number, patch: { unter?: number; wert?: number }) {
    aendere({
      ...regel,
      bereiche: regel.bereiche.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    });
  }

  function fuegeHinzu() {
    const letzterMitSchwelle = regel.bereiche.filter((b) => b.unter !== undefined).at(-1);
    const neu = { unter: (letzterMitSchwelle?.unter ?? 0) + 1, wert: 0 };
    // Vor dem Restfall einfuegen, damit er am Schluss bleibt.
    aendere({ ...regel, bereiche: [...regel.bereiche.slice(0, -1), neu, ...regel.bereiche.slice(-1)] });
  }

  function entferne(index: number) {
    aendere({ ...regel, bereiche: regel.bereiche.filter((_, i) => i !== index) });
  }

  return (
    <div className="mt-2 rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-sm">
          Merkmal
          {' '}
          <Select
            value={regel.merkmal}
            onChange={(e) => aendere({ ...regel, merkmal: e.target.value })}
          >
            {merkmale.map((m) => (
              <option key={m.id} value={m.id}>{m.bezeichnung}</option>
            ))}
          </Select>
        </label>
        <Button type="button" size="sm" onClick={fuegeHinzu}>Bereich hinzufügen</Button>
      </div>

      {befunde.length > 0 && (
        <ul className="mb-2 text-sm text-destructive">
          {befunde.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>unter</TableHead>
            <TableHead>{erfassungsform === 'relativ' ? 'Wert (%)' : 'Wert (CHF)'}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {regel.bereiche.map((b, i) => (
            <TableRow key={`${i}-${String(b.unter)}`} data-bereich={i}>
              <TableCell>
                {b.unter === undefined ? (
                  <span className="text-sm text-muted-foreground">Restfall</span>
                ) : (
                  <ZellenEingabe
                    wert={b.unter}
                    aendere={(wert) => setzeBereich(i, { unter: wert })}
                  />
                )}
              </TableCell>
              <TableCell>
                <ZellenEingabe
                  wert={anzeige(b.wert)}
                  aendere={(wert) => setzeBereich(i, { wert: ablage(wert) })}
                />
              </TableCell>
              <TableCell>
                {b.unter !== undefined && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="entfernen"
                    onClick={() => entferne(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
