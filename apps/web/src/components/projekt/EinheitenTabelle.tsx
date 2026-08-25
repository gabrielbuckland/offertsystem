'use client';

/**
 * Zentraler Block der Detailseite (Design-Spec §1, §4): eine Zeile je Einheit, editierbar
 * an Ort und Stelle, mit dem berechneten Preis sichtbar neben den Eingaben. Genau das war
 * im siebenschrittigen Assistenten nicht moeglich — dort lag zwischen Eingabe und Ergebnis
 * immer ein Schrittwechsel.
 */
import {
  createColumnHelper, flexRender, getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { formatiereAggregat } from '@offert/offer/src/format/de-ch.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { Button } from '../ui/button.js';
import { ZellenEingabe } from './ZellenEingabe.js';
import {
  faktorZuProzent, frankenZuRappen, prozentZuFaktor, rappenZuFranken,
} from './zellen-logik.js';
import type {
  AnpassungsSpalte, ProjektEinheit, Referenzobjekt,
} from '../../server/projekt-schema.js';

/** `basispreis` ist optional, weil das E-04-Teilergebnis (`honorarAbbruch.positionen`)
 *  nur den angepassten Preis je Wohnungsnummer fuehrt. Ein erfundener Basispreis waere
 *  eine Zahl ohne Rechenweg; fehlt er, bleibt allein diese Spalte auf «—» (I-24). */
export interface Preis { readonly basispreis?: number; readonly preis: number }

export interface EinheitenTabelleProps {
  readonly einheiten: readonly ProjektEinheit[];
  readonly spalten: readonly AnpassungsSpalte[];
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly preise: Readonly<Record<string, Preis>>;
  readonly aendere: (einheiten: readonly ProjektEinheit[]) => void;
}

const spalte = createColumnHelper<ProjektEinheit>();

export function EinheitenTabelle(
  {
    einheiten, spalten, referenzobjekte, preise, aendere,
  }: EinheitenTabelleProps,
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
    // Aufzaehlung machte jede neue Kategorie zu einer Codeaenderung. Ein Einzelfall ohne
    // eigene wiederverwendbare Kategorie bekommt keine eigene Zelle — er ist einfach eine
    // weitere Spalte, deren Wert bei allen anderen Einheiten auf 0 bleibt.
    ...spalten.map((s) => spalte.display({
      id: s.id,
      header: s.erfassungsform === 'absolut' ? `${s.bezeichnung} (CHF)` : `${s.bezeichnung} (%)`,
      cell: (info) => {
        const roh = info.row.original.spaltenwerte[s.id] ?? 0;
        // Die Kolonnenkopf-Einheit muss stimmen, denn `spaltenwerte` fuehrt die Rohgroesse
        // des Kerns unveraendert weiter: "(%)" -> `projektion.ts` nimmt den Wert direkt als
        // Faktor (gespeichert bleibt 0.05, angezeigt/erfasst wird 5); "(CHF)" -> der Wert
        // ist Rappen wie `erfassterBetrag` (`erfassung-schema.ts`), angezeigt/erfasst wird
        // also Franken. Beide Kolonnentypen hatten denselben Fehler — nur bei den
        // Franken-Spalten stand er faelschlich als Absicht im Kommentar (Task-11-Review,
        // Finding 2 vs. Fix Round 2).
        const angezeigt = s.erfassungsform === 'relativ'
          ? faktorZuProzent(roh)
          : rappenZuFranken(roh);
        return (
          <ZellenEingabe
            wert={angezeigt}
            aendere={(eingabe) => setze(info.row.index, {
              ...info.row.original,
              spaltenwerte: {
                ...info.row.original.spaltenwerte,
                [s.id]: s.erfassungsform === 'relativ'
                  ? prozentZuFaktor(eingabe)
                  : frankenZuRappen(eingabe),
              },
            })}
          />
        );
      },
    })),
    spalte.display({
      id: 'preis',
      header: 'Preis',
      cell: (info) => {
        const p = preise[info.row.original.id];
        return p === undefined ? '—' : formatiereAggregat(p.preis);
      },
    }),
    spalte.display({
      id: 'aktionen',
      header: '',
      cell: (info) => (
        <Button
          type="button"
          variant="outline"
          onClick={() => aendere(einheiten.filter((_, i) => i !== info.row.index))}
        >
          entfernen
        </Button>
      ),
    }),
  ];

  const tabelle = useReactTable({
    data: einheiten as ProjektEinheit[],
    columns: spaltendefinition,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <h2 className="text-base font-semibold">Einheitentabelle</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Zeigt jede Einheit mit Basispreis und angepasstem Preis nach den Zu-/Abschlägen.
      </p>
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
    </div>
  );
}
