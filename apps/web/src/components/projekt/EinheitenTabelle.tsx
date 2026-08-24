'use client';

/**
 * Zentraler Block der Detailseite (Design-Spec §1, §4): eine Zeile je Einheit, editierbar
 * an Ort und Stelle, mit dem berechneten Preis sichtbar neben den Eingaben. Genau das war
 * im siebenschrittigen Assistenten nicht moeglich — dort lag zwischen Eingabe und Ergebnis
 * immer ein Schrittwechsel.
 */
import { useState } from 'react';
import {
  createColumnHelper, flexRender, getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { formatiereAggregat } from '@offert/offer/src/format/de-ch.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { ZellenEingabe } from './ZellenEingabe.js';
import type {
  AnpassungsSpalte, ProjektEinheit, Referenzobjekt,
} from '../../server/projekt-schema.js';

export interface Preis { readonly basispreis: number; readonly preis: number }

export interface EinheitenTabelleProps {
  readonly einheiten: readonly ProjektEinheit[];
  readonly spalten: readonly AnpassungsSpalte[];
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly preise: Readonly<Record<string, Preis>>;
  readonly aendere: (einheiten: readonly ProjektEinheit[]) => void;
}

type ManuelleAnpassung = ProjektEinheit['manuelleAnpassungen'][number];

/**
 * Kompakte Erfassung fuer `manuelleAnpassungen` (Design-Spec §4, §9 Schritt 7): eine
 * Zeile je Position mit Entfernen-Aktion, darunter ein Mini-Formular zum Ergaenzen. Ein
 * voller Editor mit Vorlagenbezug waere eine eigene Aufgabe; hier reicht die einfachste
 * Form, mit der eine Begruendung erzwungen werden kann (`erfassungsSchema` verlangt eine
 * Mindestlaenge, die leere Begruendung waere sonst ein zweites, stilles Regelwerk).
 */
function ManuelleAnpassungenZelle(
  { anpassungen, aendere }: {
    readonly anpassungen: readonly ManuelleAnpassung[];
    readonly aendere: (anpassungen: readonly ManuelleAnpassung[]) => void;
  },
) {
  const [erfassungsform, setzeErfassungsform] = useState<ManuelleAnpassung['erfassungsform']>('relativ');
  const [wert, setzeWert] = useState('0');
  const [begruendung, setzeBegruendung] = useState('');

  function hinzufuegen() {
    const zahl = Number(wert);
    const bereinigt = begruendung.trim();
    if (bereinigt.length === 0 || !Number.isFinite(zahl)) return;
    aendere([...anpassungen, { erfassungsform, wert: zahl, begruendung: bereinigt }]);
    setzeWert('0');
    setzeBegruendung('');
  }

  return (
    <div className="flex min-w-48 flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {anpassungen.length} Position{anpassungen.length === 1 ? '' : 'en'}
      </span>
      {anpassungen.map((a, i) => (
        <div key={`${a.begruendung}-${i}`} className="flex items-center gap-1 text-xs">
          <span className="grow">
            {a.erfassungsform === 'absolut' ? formatiereAggregat(a.wert) : `${a.wert * 100}%`}
            {' — '}{a.begruendung}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-6 px-1 text-xs"
            onClick={() => aendere(anpassungen.filter((_, j) => j !== i))}
          >
            entfernen
          </Button>
        </div>
      ))}
      <div className="flex flex-col gap-1 border-t border-border pt-1">
        <Select
          className="h-7"
          value={erfassungsform}
          onChange={(e) => (
            setzeErfassungsform(e.target.value as ManuelleAnpassung['erfassungsform'])
          )}
        >
          <option value="relativ">relativ</option>
          <option value="absolut">Franken</option>
        </Select>
        <Input
          type="number"
          className="h-7"
          value={wert}
          onChange={(e) => setzeWert(e.target.value)}
        />
        <Input
          className="h-7"
          placeholder="Begründung"
          value={begruendung}
          onChange={(e) => setzeBegruendung(e.target.value)}
        />
        <Button
          type="button"
          className="h-7 text-xs"
          disabled={begruendung.trim().length === 0}
          onClick={hinzufuegen}
        >
          Position hinzufügen
        </Button>
      </div>
    </div>
  );
}

const spalte = createColumnHelper<ProjektEinheit>();

export function EinheitenTabelle(
  { einheiten, spalten, referenzobjekte, preise, aendere }: EinheitenTabelleProps,
) {
  /** Ersetzt genau eine Einheit; die uebrigen bleiben referenzgleich. */
  function setze(index: number, naechste: ProjektEinheit): void {
    aendere(einheiten.map((e, i) => (i === index ? naechste : e)));
  }

  const zahlenspalte = (
    schluessel: 'flaecheInnen' | 'flaecheAussen' | 'stockwerk', kopf: string,
  ) => spalte.accessor(schluessel, {
    header: kopf,
    cell: (info) => (
      <ZellenEingabe
        wert={info.getValue()}
        aendere={(wert) => setze(info.row.index, { ...info.row.original, [schluessel]: wert })}
      />
    ),
  });

  const spaltendefinition = [
    spalte.accessor('wohnungsnummer', { header: 'Objektnr.' }),
    spalte.accessor('referenzobjektId', {
      header: 'Typ',
      cell: (info) => {
        const treffer = referenzobjekte.find((r) => r.id === info.getValue());
        return treffer === undefined ? '—' : `${treffer.zimmerzahl} Zimmer`;
      },
    }),
    zahlenspalte('flaecheInnen', 'Fläche (m²)'),
    zahlenspalte('flaecheAussen', 'Aussenfläche (m²)'),
    zahlenspalte('stockwerk', 'Stockwerk'),
    // Datengetrieben: je konfigurierter Spalte genau eine Tabellenspalte. Eine feste
    // Aufzaehlung machte jede neue Kategorie zu einer Codeaenderung.
    ...spalten.map((s) => spalte.display({
      id: s.id,
      header: s.erfassungsform === 'absolut' ? `${s.bezeichnung} (CHF)` : `${s.bezeichnung} (%)`,
      cell: (info) => (
        <ZellenEingabe
          wert={info.row.original.spaltenwerte[s.id] ?? 0}
          aendere={(wert) => setze(info.row.index, {
            ...info.row.original,
            spaltenwerte: { ...info.row.original.spaltenwerte, [s.id]: wert },
          })}
        />
      ),
    })),
    spalte.display({
      id: 'manuelleAnpassungen',
      header: 'Manuelle Positionen',
      cell: (info) => (
        <ManuelleAnpassungenZelle
          anpassungen={info.row.original.manuelleAnpassungen}
          aendere={(manuelleAnpassungen) => setze(info.row.index, {
            ...info.row.original,
            manuelleAnpassungen: manuelleAnpassungen as ManuelleAnpassung[],
          })}
        />
      ),
    }),
    spalte.display({
      id: 'preis',
      header: 'Preis',
      cell: (info) => {
        const p = preise[info.row.original.id];
        return p === undefined ? '—' : formatiereAggregat(p.preis);
      },
    }),
  ];

  const tabelle = useReactTable({
    data: einheiten as ProjektEinheit[],
    columns: spaltendefinition,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {tabelle.getHeaderGroups().map((gruppe) => (
            <TableRow key={gruppe.id}>
              {gruppe.headers.map((kopf) => (
                <TableHead key={kopf.id}>
                  {flexRender(kopf.column.columnDef.header, kopf.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tabelle.getRowModel().rows.map((zeile) => (
            <TableRow key={zeile.id}>
              {zeile.getVisibleCells().map((zelle) => (
                <TableCell key={zelle.id}>
                  {flexRender(zelle.column.columnDef.cell, zelle.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
