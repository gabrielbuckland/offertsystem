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
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { formatiereAggregat } from '@offert/offer/src/format/de-ch.js';
import { normalisiereBereiche, type Bereichsregel as KernBereichsregel } from '@offert/core';
import type { AnpassungsSpalte, Merkmal } from '../../server/projekt-schema.js';
import { BereichsregelEditor } from '../einstellungen/BereichsregelEditor.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { ZellenEingabe } from './ZellenEingabe.js';
import {
  faktorZuProzent, frankenZuRappen, prozentZuFaktor, rappenZuFranken,
} from './zellen-logik.js';

export interface AnpassungsSpaltenProps {
  readonly spalten: readonly AnpassungsSpalte[];
  /** Merkmale des Projekts — nur gelesen, um die Staffel einer Regelspalte mit der
   *  Merkmalsbezeichnung («Stockwerk») statt der rohen Kennung auszuweisen. */
  readonly merkmale: readonly Merkmal[];
  readonly aendere: (spalten: readonly AnpassungsSpalte[]) => void;
  readonly entferneSpalte: (id: string) => void;
  /** Uebertraegt den Vorgabewert der Spalte in alle Einheiten ohne eigenen Wert
   *  (`uebernehmeVorgabewert`, vom Aufrufer verdrahtet — siehe ProjektAnsicht.tsx). */
  readonly uebernehmeAufEinheiten: (spalteId: string) => void;
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

/**
 * Beschreibt die Staffel einer Regelspalte lesbar («Stockwerk unter 1: CHF 8’600 · … ·
 * sonst: CHF 17’200») — der Betrag je Segment war sonst NIRGENDS in der Projektansicht
 * sichtbar, nur der Satz «Wird von der hinterlegten Regel bestimmt» (Rueckmeldung
 * Auftraggeber 2026-08-28). Reine Funktion, damit sie ohne DOM testbar bleibt (Muster
 * `zellen-logik.ts`). Der Wert wird in der Erfassungsform der SPALTE formatiert —
 * dieselbe Skalenkonvention wie in `EinheitenTabelle` (Rappen bei 'absolut', Faktor bei
 * 'relativ').
 */
export function beschreibeStaffel(
  spalte: AnpassungsSpalte, merkmale: readonly Merkmal[],
): string {
  const regel = spalte.regel;
  if (regel === undefined) return '';
  const merkmal = merkmale.find((m) => m.id === regel.merkmal)?.bezeichnung ?? regel.merkmal;
  const betrag = (wert: number) => (spalte.erfassungsform === 'absolut'
    ? formatiereAggregat(wert)
    : `${String(faktorZuProzent(wert))} %`);
  const teile = regel.bereiche.map((b) => (b.unter === undefined
    ? `sonst: ${betrag(b.wert)}`
    : `unter ${String(b.unter)}: ${betrag(b.wert)}`));
  return `${merkmal} — ${teile.join(' · ')}`;
}

/**
 * Umbau einer Spalte auf eine Merkmals-Staffel bzw. zurueck auf einen festen Vorgabewert.
 * Reine Funktionen (Muster `zellen-logik.ts`), weil das Schema `regel` und `vorgabewert`
 * gegenseitig ausschliesst (`projekt-schema.ts`, REGEL_UND_VORGABEWERT): Der jeweils
 * andere Schluessel muss beim Umbau ENTFERNT werden, nicht auf `undefined` gesetzt —
 * sonst scheiterte jedes PUT des Projekts.
 */
export function spalteMitRegel(s: AnpassungsSpalte, merkmalId: string): AnpassungsSpalte {
  const { vorgabewert: _vorgabewert, ...rest } = s;
  // Ein Startbereich, der nur den Restfall traegt: die Staffel ist damit sofort total
  // und gueltig (`pruefeBereiche`), die Segmente ergaenzt der Vermarkter im Editor.
  return { ...rest, regel: { merkmal: merkmalId, bereiche: [{ wert: 0 }] } };
}

export function spalteOhneRegel(s: AnpassungsSpalte): AnpassungsSpalte {
  const { regel: _regel, ...rest } = s;
  return { ...rest, vorgabewert: 0 };
}

/** Bringt die im Editor geaenderte Kern-Regel auf die Schemaform des Projekts
 *  (readonly-Array -> gewoehnliches Array, flache Kopie wie `spalten-vorbelegung.ts`). */
export function spalteMitGeaenderterRegel(
  s: AnpassungsSpalte, regel: KernBereichsregel,
): AnpassungsSpalte {
  return {
    ...s,
    regel: { merkmal: regel.merkmal, bereiche: regel.bereiche.map((b) => ({ ...b })) },
  };
}

export function AnpassungsSpalten(
  { spalten, merkmale, aendere, entferneSpalte, uebernehmeAufEinheiten }: AnpassungsSpaltenProps,
) {
  // Aufgeklappte Spalten (Akkordeon): Die Staffel wird in einer Detailzeile UNTER der
  // Spaltenzeile bearbeitet, nicht in einem eigenen Dialog — sie gehoert sichtbar zur
  // Spalte (Rueckmeldung Auftraggeber 2026-08-28).
  const [offene, setzeOffene] = useState<readonly string[]>([]);
  function schalte(id: string): void {
    setzeOffene((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }
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
      // Nicht leer: `anpassungsSpalteSchema` verlangt `min(1)`, eine namenlose Spalte
      // liesse also jedes PUT mit 422 scheitern, bis ein Name getippt ist — sichtbar als
      // «Änderung konnte nicht gespeichert werden» nach JEDEM «Spalte hinzufügen».
      bezeichnung: 'Neue Spalte',
      erfassungsform: 'relativ',
      vorgabewert: 0,
    }]);
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Zu-/Abschläge — Spalten</h2>
          <p className="text-sm text-muted-foreground">
            Definiert Zu- und Abschläge, die je Einheit auf den Referenzwert wirken.
          </p>
        </div>
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
              <TableHead className="w-8" />
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Erfassungsform</TableHead>
              <TableHead>Vorgabewert</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {spalten.map((s) => (
              <Fragment key={s.id}>
              <TableRow>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={offene.includes(s.id) ? 'Details schliessen' : 'Details öffnen'}
                    aria-expanded={offene.includes(s.id)}
                    onClick={() => schalte(s.id)}
                  >
                    {offene.includes(s.id)
                      ? <ChevronDown className="size-4" />
                      : <ChevronRight className="size-4" />}
                  </Button>
                </TableCell>
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
                  {s.regel === undefined ? (
                    <>
                      <div className="flex items-center gap-1">
                        {/*
                          Angezeigt und erfasst wird die Einheit, in der ein Mensch denkt —
                          Prozent bei 'relativ', Franken bei 'absolut' —, gespeichert die des
                          Kerns (Faktor bzw. Rappen). GENAU wie in `EinheitenTabelle`: Der
                          Vorgabewert wird von dort in dieselbe Groesse uebernommen
                          (einheiten-generator.ts), zwei verschiedene Skalen fuer dieselbe
                          Groesse waeren der Fehler, der schon einmal den Faktor 100
                          verursacht hat.
                        */}
                        <ZellenEingabe
                          wert={s.erfassungsform === 'relativ'
                            ? faktorZuProzent(s.vorgabewert ?? 0)
                            : rappenZuFranken(s.vorgabewert ?? 0)}
                          aendere={(eingabe) => aktualisiere(s.id, {
                            vorgabewert: s.erfassungsform === 'relativ'
                              ? prozentZuFaktor(eingabe)
                              : frankenZuRappen(eingabe),
                          })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {s.erfassungsform === 'relativ' ? '%' : 'CHF'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Wirkt auf neu erzeugte Einheiten.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => uebernehmeAufEinheiten(s.id)}
                      >
                        Auf leere Zellen übernehmen
                      </Button>
                    </>
                  ) : (
                    // Schema (`projekt-schema.ts`) schliesst `regel` und `vorgabewert` an
                    // derselben Spalte aus — ein Eingabefeld hier haette ein Projekt mit
                    // Regel unspeicherbar gemacht, sobald jemand hineintippt (die
                    // firmenweite Vorlage `stockwerklage` traegt eine Regel und bringt
                    // diesen Fall damit in jedes neue Projekt). Die Staffel selbst wird
                    // aber AUSGEWIESEN — vorher stand hier nur ein Satz, und welcher
                    // Betrag in welchem Segment gilt, war in der Projektansicht nirgends
                    // sichtbar. Bearbeitet wird sie in der aufklappbaren Detailzeile
                    // (Akkordeon, `BereichsregelEditor`); firmenweit zusaetzlich unter
                    // Einstellungen → Preisanpassung & Vorlagen.
                    <>
                      <p className="text-xs font-medium text-foreground/80">
                        {beschreibeStaffel(s, merkmale)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Staffel nach Merkmal — zum Bearbeiten die Zeile aufklappen.
                      </p>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Entfernt die Spalte und ihre Werte aus allen Einheiten."
                    aria-label="entfernen"
                    onClick={() => entferneSpalte(s.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
              {offene.includes(s.id) && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-muted/30">
                    {s.regel === undefined ? (
                      <div className="flex items-center gap-3 py-1">
                        <p className="text-sm text-muted-foreground">
                          Diese Spalte trägt einen festen Vorgabewert. Alternativ kann sie
                          einer Staffel nach Merkmal folgen (z.&nbsp;B. Zuschlag je
                          Stockwerk).
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={merkmale.length === 0}
                          title={merkmale.length === 0
                            ? 'Es ist kein Merkmal konfiguriert.' : undefined}
                          onClick={() => aendere(spalten.map((x) => (
                            x.id === s.id ? spalteMitRegel(x, merkmale[0]!.id) : x)))}
                        >
                          Staffel nach Merkmal einführen
                        </Button>
                      </div>
                    ) : (
                      <div className="py-1">
                        <BereichsregelEditor
                          // `normalisiereBereiche` bringt die Zod-Optionalitaet
                          // (`unter?: number | undefined`) auf die Kernform
                          // (`unter?: number`) — dasselbe Muster wie im Schema selbst
                          // (`projekt-schema.ts`, superRefine).
                          regel={{
                            merkmal: s.regel.merkmal,
                            bereiche: normalisiereBereiche(s.regel.bereiche),
                          }}
                          merkmale={merkmale}
                          erfassungsform={s.erfassungsform}
                          aendere={(regel) => aendere(spalten.map((x) => (
                            x.id === s.id ? spalteMitGeaenderterRegel(x, regel) : x)))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => aendere(spalten.map((x) => (
                            x.id === s.id ? spalteOhneRegel(x) : x)))}
                        >
                          Staffel entfernen (fester Vorgabewert)
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
