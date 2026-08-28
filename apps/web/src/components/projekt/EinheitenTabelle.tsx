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

/** `basispreis` ist optional, weil das E-04-Teilergebnis (`honorarAbbruch.positionen`)
 *  nur den angepassten Preis je Wohnungsnummer fuehrt. Ein erfundener Basispreis waere
 *  eine Zahl ohne Rechenweg; fehlt er, bleibt allein diese Spalte auf «—» (I-24). */
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

/**
 * Schreibt einen erfassten Zellwert als Uebersteuerung in `spaltenwerte` — aber nur, wenn
 * er vom aktuell wirksamen Wert abweicht.
 *
 * `ZellenEingabe` meldet beim Verlassen des Feldes unbedingt, auch wenn sich der Entwurf
 * gegenueber dem Anzeigewert nicht veraendert hat — reines Durchtabben genuegt (siehe
 * dortiger Kommentar). Fuer eine regelgetriebene Spalte wuerde das den abgeleiteten
 * Regelwert unveraendert als Uebersteuerung festschreiben: `ermittleWirksamenWert` wiese
 * `uebersteuert: true` aus, obwohl der Vermarkter nichts entschieden hat, und die Zelle
 * folgte einer spaeteren Aenderung der firmenweiten Staffel nicht mehr (Review-Finding 1).
 * Deshalb schreibt diese Funktion nur, wenn der abgelegte Wert vom uebergebenen wirksamen
 * Wert abweicht.
 */
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

/** Entfernt eine Uebersteuerung wieder aus `spaltenwerte` — danach gilt der Regelwert. */
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
  /** Ersetzt genau eine Einheit; die uebrigen bleiben referenzgleich. */
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
    // Je konfiguriertem Merkmal (Projekt.merkmale) eine Zahlenspalte — analog zu
    // `zahlenspalte` unten, aber ueber `merkmalswerte` statt ueber ein festes Feld der
    // Einheit. Das Merkmal selbst ist reine Eingabe; ob es irgendwo eine Regel speist,
    // entscheidet sich erst an der Zu-/Abschlagsspalte weiter unten. Position direkt
    // nach «Typ», vor den Flaechen (Rueckmeldung Auftraggeber 2026-08-28): das Merkmal
    // (z. B. Stockwerk) beschreibt wie der Typ die Wohnung selbst, nicht ihre Masse.
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
    // Datengetrieben: je konfigurierter Spalte genau eine Tabellenspalte. Eine feste
    // Aufzaehlung machte jede neue Kategorie zu einer Codeaenderung. Ein Einzelfall ohne
    // eigene wiederverwendbare Kategorie bekommt keine eigene Zelle — er ist einfach eine
    // weitere Spalte, deren Wert bei allen anderen Einheiten auf 0 bleibt.
    //
    // Hier endete frueher die feste Aufzaehlung mit einer Spalte «Stockwerk». Sie war das
    // Gegenbeispiel zur eigenen Regel: ein hart verdrahtetes Merkmal, das in keine Formel
    // einging und nur Ablesegrundlage fuer die Wahl eines Zu-/Abschlags war. Das Stockwerk
    // ist jetzt eine Merkmalsspalte (oben, ueber `merkmale`/`merkmalswerte`) und speist von
    // dort aus die Bereichsregel der Anpassungsspalte `stockwerklage`: eine Staffel statt
    // eines festen Faktors, mit Regelspur und Uebersteuerung wie unten dargestellt. Die
    // Vorlagen `erdgeschoss_gartensitzplatz` und `erdgeschoss_einsehbar` bleiben als
    // gewoehnliche, regellose Anpassungsspalten bestehen — sie beschreiben Eigenschaften der
    // Erdgeschosslage, die die Stockwerkstaffel nicht abbildet.
    ...spalten.map((s) => spalte.display({
      id: s.id,
      header: s.erfassungsform === 'absolut' ? `${s.bezeichnung} (CHF)` : `${s.bezeichnung} (%)`,
      cell: (info) => {
        const einheit = info.row.original;
        // Die Kolonnenkopf-Einheit muss stimmen, denn `spaltenwerte` fuehrt die Rohgroesse
        // des Kerns unveraendert weiter: "(%)" -> `projektion.ts` nimmt den Wert direkt als
        // Faktor (gespeichert bleibt 0.05, angezeigt/erfasst wird 5); "(CHF)" -> der Wert
        // ist Rappen wie `erfassterBetrag` (`erfassung-schema.ts`), angezeigt/erfasst wird
        // also Franken. Beide Kolonnentypen hatten denselben Fehler — nur bei den
        // Franken-Spalten stand er faelschlich als Absicht im Kommentar (Task-11-Review,
        // Finding 2 vs. Fix Round 2).
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

        // Die Rangfolge (Uebersteuerung vor Regel, keine Behauptung ohne Beleg bei
        // fehlendem Merkmalswert) steht an genau einer Stelle (`ermittleWirksamenWert`) —
        // hier wird nur noch das Ergebnis dargestellt, nicht neu entschieden (I-24).
        const wirksam = ermittleWirksamenWert(s, einheit);
        if (wirksam === undefined) {
          // Kein Merkmalswert: Die Regel kann nichts sagen, und eine 0 waere eine
          // Behauptung. Das Feld bleibt leer und die Zelle weist den Grund aus (I-24).
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
              // `wirksam.regel` ist hier nur gesetzt, wenn die Regel tatsaechlich
              // ausgewertet wurde (siehe `ermittleWirksamenWert`); ohne Regel im Ergebnis
              // waere dieser Zweig eine Behauptung ohne Beleg — daher die Bedingung.
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
