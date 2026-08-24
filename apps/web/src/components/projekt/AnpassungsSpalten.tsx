'use client';

/**
 * Spaltenkonfiguration der Zu-/Abschlaege (Design-Spec §1). Die Spalten eines Projekts
 * sind aus den firmenweiten Vorlagen VORBELEGT, nicht vorgegeben (US-04 AK 5, E-25):
 * das Excel des Auftraggebers zeigt je Blatt einen anderen Spaltenschnitt, darum lassen
 * sich Spalten hier ergaenzen, umbenennen und entfernen.
 *
 * Wird eine Spalte entfernt, muessen die zugehoerigen `spaltenwerte` aus allen Einheiten
 * verschwinden — sonst truege das Artefakt Werte ohne Spalte, die die Projektion
 * stillschweigend ignoriert und die bei Wiederverwendung derselben Spalten-ID
 * unbeabsichtigt wieder auflebten.
 *
 * `entferneSpalte` ist deshalb ein EIGENER Pflicht-Rueckruf, nicht ein optionales
 * zweites Argument von `aendere`: TypeScript ist in der Parameterzahl kontravariant,
 * ein Aufrufer, der `aendere={(neue) => setSpalten(neue)}` schreibt, wuerde ein
 * optionales Argument typkorrekt verschlucken und die Kaskade stillschweigend
 * auslassen. Ein eigener Pflicht-Rueckruf macht das Weglassen an der JSX-Aufrufstelle
 * zu einem Kompilierfehler.
 */
import { useRef } from 'react';
import type { AnpassungsSpalte } from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';

export interface AnpassungsSpaltenProps {
  readonly spalten: readonly AnpassungsSpalte[];
  readonly aendere: (spalten: readonly AnpassungsSpalte[]) => void;
  readonly entferneSpalte: (id: string) => void;
}

/**
 * Reine Zaehlerfabrik: einmal pro Komponenteninstanz erzeugt (siehe `useRef` unten) und
 * danach nur inkrementiert, nie aus der aktuellen Spaltenliste neu abgeleitet. Eine
 * waehrend der Sitzung entfernte Kennung wird dadurch nicht sofort wiederverwendet —
 * sonst erbte eine neue Spalte ueber dieselbe ID unbeabsichtigt die `spaltenwerte`
 * der entfernten (siehe Kommentar oben).
 */
export function erzeugeSpaltenIdFolge(vorhandene: readonly AnpassungsSpalte[]): () => string {
  let hoechste = vorhandene.reduce((max, s) => {
    const treffer = /^S-(\d+)$/.exec(s.id);
    return treffer === null ? max : Math.max(max, Number(treffer[1]));
  }, 0);
  return () => {
    hoechste += 1;
    return `S-${hoechste}`;
  };
}

export function AnpassungsSpalten({ spalten, aendere, entferneSpalte }: AnpassungsSpaltenProps) {
  const naechsteId = useRef<(() => string) | undefined>(undefined);
  if (naechsteId.current === undefined) {
    naechsteId.current = erzeugeSpaltenIdFolge(spalten);
  }

  function aktualisiere(id: string, patch: Partial<AnpassungsSpalte>) {
    aendere(spalten.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function fuegeHinzu() {
    aendere([...spalten, {
      id: naechsteId.current!(),
      bezeichnung: '',
      erfassungsform: 'relativ',
      vorgabewert: 0,
    }]);
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Zu-/Abschläge — Spalten</h2>
        <Button type="button" onClick={fuegeHinzu}>
          Spalte hinzufügen
        </Button>
      </div>
      {spalten.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Spalte erfasst.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Erfassungsform</TableHead>
              <TableHead>Vorgabewert</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {spalten.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Input
                    value={s.bezeichnung}
                    onChange={(e) => aktualisiere(s.id, { bezeichnung: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={s.erfassungsform}
                    onChange={(e) => aktualisiere(s.id, {
                      erfassungsform: e.target.value as AnpassungsSpalte['erfassungsform'],
                    })}
                  >
                    <option value="relativ">relativ</option>
                    <option value="absolut">Franken</option>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={s.vorgabewert}
                    onChange={(e) => aktualisiere(s.id, { vorgabewert: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="outline" onClick={() => entferneSpalte(s.id)}>
                    entfernen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
