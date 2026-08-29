'use client';

// Zentraler Block der Detailseite (Design-Spec §1, §4): eine Zeile je Einheit, editierbar
// an Ort und Stelle, mit dem berechneten Preis sichtbar neben den Eingaben.
import {
  createColumnHelper, flexRender, getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { formatiereAggregat } from '@offert/offer/src/format/de-ch.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { Button } from '../ui/button.js';
import { ZellenEingabe } from './ZellenEingabe.js';
import {
  faktorZuProzent, frankenZuRappen, prozentZuFaktor, rappenZuFranken,
} from './zellen-logik.js';
import { ermittleWirksamenWert } from '../../server/wirksamer-wert.js';
import type {
  AnpassungsSpalte, Merkmal, ProjektEinheit, Referenzobjekt,
} from '../../server/projekt-schema.js';

// E-04, I-24: `basispreis` ist optional, weil das Teilergebnis nur den angepassten Preis
// je Wohnungsnummer fuehrt; fehlt er, bleibt allein diese Spalte auf «—».
export interface Preis { readonly basispreis?: number; readonly preis: number }

export interface EinheitenTabelleProps {
  readonly einheiten: readonly ProjektEinheit[];
  readonly spalten: readonly AnpassungsSpalte[];
  readonly merkmale: readonly Merkmal[];
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly preise: Readonly<Record<string, Preis>>;
  readonly aendere: (einheiten: readonly ProjektEinheit[]) => void;
}

const spalte = createColumnHelper<ProjektEinheit>();

// Schreibt nur, wenn der Wert vom wirksamen Wert abweicht: `ZellenEingabe` meldet auch bei
// reinem Durchtabben ohne Aenderung, und ein Regelwert unveraendert als Uebersteuerung
// festzuschreiben wuerde die Zelle von spaeteren Aenderungen der firmenweiten Staffel
// abkoppeln.
function schreibeUebersteuerung(
  spalte: AnpassungsSpalte,
  einheit: ProjektEinheit,
  wirksamerWert: number,
  wert: number,
  ablage: (w: number) => number,
  setze: (naechste: ProjektEinheit) => void,
): void {
  const abgelegt = ablage(wert);
  if (abgelegt === wirksamerWert) return;
  setze({ ...einheit, spaltenwerte: { ...einheit.spaltenwerte, [spalte.id]: abgelegt } });
}

function setzeUebersteuerungZurueck(
  spalte: AnpassungsSpalte,
  einheit: ProjektEinheit,
  setze: (naechste: ProjektEinheit) => void,
): void {
  const rest = { ...einheit.spaltenwerte };
  delete rest[spalte.id];
  setze({ ...einheit, spaltenwerte: rest });
}

export function EinheitenTabelle(
  {
    einheiten, spalten, merkmale, referenzobjekte, preise, aendere,
  }: EinheitenTabelleProps,
) {
  function setze(index: number, naechste: ProjektEinheit): void {
    aendere(einheiten.map((e, i) => (i === index ? naechste : e)));
  }

  const zahlenspalte = (
    schluessel: 'flaecheInnen' | 'flaecheAussen', kopf: string,
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
    // Je konfiguriertem Merkmal eine Zahlenspalte, ueber `merkmalswerte` statt ueber ein
    // festes Feld der Einheit. Position vor den Flaechen: das Merkmal (z. B. Stockwerk)
    // beschreibt wie der Typ die Wohnung selbst, nicht ihre Masse.
    ...merkmale.map((m) => spalte.display({
      id: `merkmal-${m.id}`,
      header: m.bezeichnung,
      cell: (info) => (
        <ZellenEingabe
          wert={info.row.original.merkmalswerte[m.id] ?? 0}
          aendere={(wert) => setze(info.row.index, {
            ...info.row.original,
            merkmalswerte: { ...info.row.original.merkmalswerte, [m.id]: wert },
          })}
        />
      ),
    })),
    zahlenspalte('flaecheInnen', 'Fläche (m²)'),
    zahlenspalte('flaecheAussen', 'Aussenfläche (m²)'),
    // Datengetrieben: je konfigurierter Spalte genau eine Tabellenspalte, keine feste
    // Aufzaehlung.
    ...spalten.map((s) => spalte.display({
      id: s.id,
      header: s.erfassungsform === 'absolut' ? `${s.bezeichnung} (CHF)` : `${s.bezeichnung} (%)`,
      cell: (info) => {
        const einheit = info.row.original;
        // `spaltenwerte` fuehrt die Rohgroesse des Kerns unveraendert weiter: "(%)" -> Wert
        // gespeichert als Faktor (0.05), angezeigt als 5; "(CHF)" -> Wert gespeichert in
        // Rappen, angezeigt in Franken.
        const anzeige = (w: number) => (s.erfassungsform === 'relativ'
          ? faktorZuProzent(w) : rappenZuFranken(w));
        const ablage = (w: number) => (s.erfassungsform === 'relativ'
          ? prozentZuFaktor(w) : frankenZuRappen(w));

        const setzeEinheit = (naechste: ProjektEinheit) => setze(info.row.index, naechste);

        if (s.regel === undefined) {
          const schreibe = (wert: number) => setzeEinheit({
            ...einheit,
            spaltenwerte: { ...einheit.spaltenwerte, [s.id]: ablage(wert) },
          });
          return (
            <ZellenEingabe wert={anzeige(einheit.spaltenwerte[s.id] ?? 0)} aendere={schreibe} />
          );
        }

        // I-24: Rangfolge (Uebersteuerung vor Regel) steht allein in `ermittleWirksamenWert`,
        // hier wird nur dargestellt.
        const wirksam = ermittleWirksamenWert(s, einheit);
        if (wirksam === undefined) {
          // Kein Merkmalswert: eine 0 waere eine Behauptung ohne Beleg (I-24).
          return <span className="text-sm text-muted-foreground">Merkmal fehlt</span>;
        }

        return (
          <div>
            <ZellenEingabe
              wert={anzeige(wirksam.wert)}
              aendere={(wert) => schreibeUebersteuerung(s, einheit, wirksam.wert, wert, ablage, setzeEinheit)}
            />
            {wirksam.uebersteuert === true ? (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {`übersteuert (Regel: ${String(anzeige(wirksam.regel!.regelwert))})`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setzeUebersteuerungZurueck(s, einheit, setzeEinheit)}
                >
                  zurücksetzen
                </Button>
              </div>
            ) : (
              // `wirksam.regel` ist nur gesetzt, wenn die Regel tatsaechlich ausgewertet
              // wurde.
              wirksam.regel !== undefined && (
                <span className="mt-1 block text-xs text-muted-foreground">aus Regel</span>
              )
            )}
          </div>
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
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="entfernen"
          onClick={() => aendere(einheiten.filter((_, i) => i !== info.row.index))}
        >
          <Trash2 className="size-4" />
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
      <div className="overflow-hidden rounded-md border border-border">
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
