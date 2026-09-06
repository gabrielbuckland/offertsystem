'use client';

// `id` ist nach Ableitung schreibgeschuetzt: sie ist der Anker, ueber den eine
// Bereichsregel ihr Merkmal findet (`regel.merkmal`).
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

export function ableiteMerkmalId(bezeichnung: string): string {
  const roh = bezeichnung.trim().toLowerCase()
    .replace(/[äöü]/g, (z) => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[z] ?? z))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(roh) ? roh : `m_${roh}`;
}

// Aus hoechster vergebener `merkmal_<n>`-Kennung, nicht aus Listenlaenge (kollidiert nach Loeschung).
export function naechsteMerkmalId(merkmale: readonly Merkmal[]): string {
  const hoechste = merkmale.reduce((max, m) => {
    const treffer = /^merkmal_(\d+)$/.exec(m.id);
    return treffer === null ? max : Math.max(max, Number(treffer[1]));
  }, 0);
  return ableiteMerkmalId(`merkmal ${hoechste + 1}`);
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
            id: naechsteMerkmalId(merkmale),
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
