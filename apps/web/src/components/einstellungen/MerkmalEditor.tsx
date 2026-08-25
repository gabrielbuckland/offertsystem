'use client';

/**
 * Verwaltet die firmenweiten Merkmale. Die Kennung wird aus der Bezeichnung abgeleitet
 * und ist danach schreibgeschuetzt: Sie ist der Anker, ueber den eine Bereichsregel ihr
 * Merkmal findet (`regel.merkmal`), und eine nachtraegliche Umbenennung liesse jede
 * darauf verweisende Regel ins Leere laufen.
 *
 * Typ aus `@offert/core` wie in `BereichsregelEditor.tsx` — siehe dortiger Kommentar
 * zur Wahl zwischen Kern- und Projektartefakt-Typ.
 */
import { Trash2 } from 'lucide-react';
import type { Merkmal } from '@offert/core';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';

export interface MerkmalEditorProps {
  readonly merkmale: readonly Merkmal[];
  readonly aendere: (merkmale: readonly Merkmal[]) => void;
}

/** Gleiches Muster wie `ableiteVorlagenId` in PreisanpassungEditor.tsx. */
export function ableiteMerkmalId(bezeichnung: string): string {
  const roh = bezeichnung.trim().toLowerCase()
    .replace(/[äöü]/g, (z) => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[z] ?? z))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(roh) ? roh : `m_${roh}`;
}

export function MerkmalEditor({ merkmale, aendere }: MerkmalEditorProps) {
  return (
    <section className="mb-6 space-y-2 rounded-md border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Merkmale</h3>
          <p className="text-sm text-muted-foreground">
            Zahlenwerte je Einheit, auf die sich Bereichsregeln beziehen können.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => aendere([...merkmale, {
            id: ableiteMerkmalId(`merkmal ${merkmale.length + 1}`),
            bezeichnung: 'Neues Merkmal',
            form: 'zahl',
          }])}
        >
          Merkmal hinzufügen
        </Button>
      </div>
      {merkmale.length === 0 ? (
        <p className="text-muted-foreground">Noch kein Merkmal erfasst.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kennung</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {merkmale.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-sm text-muted-foreground">{m.id}</TableCell>
                <TableCell>
                  <Input
                    value={m.bezeichnung}
                    onChange={(e) => aendere(merkmale.map(
                      (x) => (x.id === m.id ? { ...x, bezeichnung: e.target.value } : x),
                    ))}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="entfernen"
                    title="Regeln, die dieses Merkmal verwenden, werden dadurch ungültig."
                    onClick={() => aendere(merkmale.filter((x) => x.id !== m.id))}
                  >
                    <Trash2 className="size-4" />
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
