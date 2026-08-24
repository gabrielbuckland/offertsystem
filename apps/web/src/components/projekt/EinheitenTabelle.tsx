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
import { formatiereAggregat, formatiereProzent } from '@offert/offer/src/format/de-ch.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { ZellenEingabe } from './ZellenEingabe.js';
import {
  faktorZuProzent, frankenZuRappen, istBegruendungGueltig, prozentZuFaktor, rappenZuFranken,
} from './zellen-logik.js';
import type {
  AnpassungsSpalte, ProjektEinheit, Referenzobjekt,
} from '../../server/projekt-schema.js';

export interface Preis { readonly basispreis: number; readonly preis: number }

export interface EinheitenTabelleProps {
  readonly einheiten: readonly ProjektEinheit[];
  readonly spalten: readonly AnpassungsSpalte[];
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly preise: Readonly<Record<string, Preis>>;
  // Von der Konfiguration des Aufrufers durchgereicht (`preisanpassung.begruendungMinLaenge`),
  // nicht hier fest verdrahtet — sonst entstuende neben `erfassungsSchema` ein zweiter,
  // driftender Regelort fuer dieselbe Mindestlaenge (Task-11-Review, Finding 3).
  readonly begruendungMinLaenge: number;
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
  { anpassungen, begruendungMinLaenge, aendere }: {
    readonly anpassungen: readonly ManuelleAnpassung[];
    readonly begruendungMinLaenge: number;
    readonly aendere: (anpassungen: readonly ManuelleAnpassung[]) => void;
  },
) {
  const [erfassungsform, setzeErfassungsform] = useState<ManuelleAnpassung['erfassungsform']>('relativ');
  // Das Feld zeigt und erfasst die Einheit, in der ein Mensch tatsaechlich denkt —
  // Prozent bei 'relativ', Franken bei 'absolut' — gespeichert wird immer die Einheit
  // des Kerns (Faktor bzw. Rappen). Ohne diese Umrechnung waere eine hier eingetippte "5"
  // bei 'relativ' ein Faktor von 5 statt 0.05, und ein eingetipptes "10000" bei 'absolut'
  // 100 Rappen statt CHF 10'000 (Task-11-Review, Finding 2 und Fix Round 2 — derselbe
  // Fehler wie bei den Anpassungsspalten, hier nur unbeobachtet, weil kein Kolonnenkopf
  // ihn ankuendigt).
  const [wert, setzeWert] = useState('0');
  const [begruendung, setzeBegruendung] = useState('');

  const begruendungGueltig = istBegruendungGueltig(begruendung, begruendungMinLaenge);

  function hinzufuegen() {
    const zahl = Number(wert);
    if (!begruendungGueltig || !Number.isFinite(zahl)) return;
    const gespeichert = erfassungsform === 'relativ' ? prozentZuFaktor(zahl) : frankenZuRappen(zahl);
    aendere([...anpassungen, { erfassungsform, wert: gespeichert, begruendung: begruendung.trim() }]);
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
            {a.erfassungsform === 'absolut' ? formatiereAggregat(a.wert) : formatiereProzent(a.wert)}
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
          <option value="relativ">relativ (%)</option>
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
        <span className="text-xs text-muted-foreground">
          Mindestens {begruendungMinLaenge} Zeichen.
        </span>
        <Button
          type="button"
          className="h-7 text-xs"
          disabled={!begruendungGueltig}
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
  {
    einheiten, spalten, referenzobjekte, preise, begruendungMinLaenge, aendere,
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
    // Aufzaehlung machte jede neue Kategorie zu einer Codeaenderung.
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
      id: 'manuelleAnpassungen',
      header: 'Manuelle Positionen',
      cell: (info) => (
        <ManuelleAnpassungenZelle
          anpassungen={info.row.original.manuelleAnpassungen}
          begruendungMinLaenge={begruendungMinLaenge}
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
