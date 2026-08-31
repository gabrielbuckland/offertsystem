'use client';

/**
 * Spaltenkonfiguration der Zu-/Abschlaege (US-04 AK 5, E-25): Spalten sind vorbelegt, nicht
 * vorgegeben, und lassen sich ergaenzen, umbenennen und entfernen.
 *
 * Wird eine Spalte entfernt, muessen die zugehoerigen `spaltenwerte` aus allen Einheiten
 * verschwinden — sonst leben sie bei Wiederverwendung derselben Spalten-ID unbeabsichtigt
 * wieder auf. `entferneSpalte` ist deshalb ein eigener Pflicht-Rueckruf statt eines
 * optionalen zweiten Arguments von `aendere`: TypeScript ist in der Parameterzahl
 * kontravariant und wuerde ein fehlendes optionales Argument sonst typkorrekt verschlucken.
 *
 * Die Detailzeile bleibt IMMER gemountet und wird nur per CSS (`hidden`) ausgeblendet,
 * nicht per bedingtem Rendering (`isOffen && …`): Die Testsuite faengt Handler ab, die
 * waehrend eines einzigen `renderToStaticMarkup`-Durchlaufs entstehen (kein DOM, keine
 * simulierten Klicks, siehe `AnpassungsSpalten.test.tsx`); ein bedingt weggelassener
 * Teilbaum waere fuer sie unerreichbar. Sichtbar/unsichtbar ist fuer den Vermarkter
 * dasselbe Ergebnis wie gemountet/nicht gemountet.
 */
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatiereAggregat } from '@offert/offer';
import { normalisiereBereiche, type Bereichsregel as KernBereichsregel } from '@offert/core';
import type { AnpassungsSpalte, Merkmal } from '../../server/projekt-schema.js';
import { BereichsregelEditor } from '../einstellungen/BereichsregelEditor.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select } from '../ui/select.js';
import { ZellenEingabe } from './ZellenEingabe.js';
import {
  faktorZuProzent, frankenZuRappen, prozentZuFaktor, rappenZuFranken,
} from './zellen-logik.js';

export interface AnpassungsSpaltenProps {
  readonly spalten: readonly AnpassungsSpalte[];
  /** Nur gelesen, um die Staffel einer Regelspalte mit der Merkmalsbezeichnung statt der
   *  rohen Kennung auszuweisen. */
  readonly merkmale: readonly Merkmal[];
  readonly aendere: (spalten: readonly AnpassungsSpalte[]) => void;
  readonly entferneSpalte: (id: string) => void;
  /** Uebertraegt den Vorgabewert der Spalte in alle Einheiten ohne eigenen Wert
   *  (verdrahtet in ProjektAnsicht.tsx). */
  readonly uebernehmeAufEinheiten: (spalteId: string) => void;
}

/**
 * Zaehler wird einmal pro Komponenteninstanz erzeugt und danach nur inkrementiert, nie aus
 * der aktuellen Spaltenliste neu abgeleitet — sonst wuerde eine waehrend der Sitzung
 * entfernte ID sofort wiederverwendet und eine neue Spalte erbte die `spaltenwerte` der
 * entfernten (siehe Kommentar oben).
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
 * Beschreibt die Staffel einer Regelspalte lesbar («Stockwerk: unter 1 CHF 8’600 · sonst
 * CHF 17’200»). Reine Funktion, damit sie ohne DOM testbar bleibt (Muster
 * `zellen-logik.ts`). Formatiert in der Skala der Spalte (Rappen bei 'absolut', Faktor bei
 * 'relativ'), wie `EinheitenTabelle`.
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
    ? `sonst ${betrag(b.wert)}`
    : `unter ${String(b.unter)} ${betrag(b.wert)}`));
  return `${merkmal}: ${teile.join(' · ')}`;
}

/**
 * Umbau einer Spalte auf eine Merkmals-Staffel bzw. zurueck auf einen festen Vorgabewert.
 * Das Schema schliesst `regel` und `vorgabewert` gegenseitig aus (REGEL_UND_VORGABEWERT):
 * der jeweils andere Schluessel muss beim Umbau ENTFERNT werden, nicht auf `undefined`
 * gesetzt — sonst scheiterte jedes PUT des Projekts.
 */
export function spalteMitRegel(s: AnpassungsSpalte, merkmalId: string): AnpassungsSpalte {
  const { vorgabewert: _vorgabewert, ...rest } = s;
  // Startbereich traegt nur den Restfall: die Staffel ist damit sofort total und gueltig.
  return { ...rest, regel: { merkmal: merkmalId, bereiche: [{ wert: 0 }] } };
}

export function spalteOhneRegel(s: AnpassungsSpalte): AnpassungsSpalte {
  const { regel: _regel, ...rest } = s;
  return { ...rest, vorgabewert: 0 };
}

/** Bringt die im Editor geaenderte Kern-Regel auf die Schemaform des Projekts. */
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
      // liesse jedes PUT mit 422 scheitern, bis ein Name getippt ist.
      bezeichnung: 'Neue Spalte',
      erfassungsform: 'relativ',
      vorgabewert: 0,
    }]);
  }

  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Zu-/Abschläge</h2>
          <p className="text-sm text-muted-foreground">
            Wirken je Einheit auf den Referenzwert. Der Vorgabewert gilt für neu erzeugte
            Einheiten, erfasst wird je Einheit in der Einheitentabelle.
          </p>
        </div>
        <Button type="button" onClick={fuegeHinzu}>
          Spalte hinzufügen
        </Button>
      </div>
      {spalten.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Spalte erfasst.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border divide-y divide-border">
          {spalten.map((s) => {
            const isOffen = offene.includes(s.id);
            return (
            <div key={s.id} className="bg-card">
              <div
                className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                onClick={() => schalte(s.id)}
              >
                <div className="flex flex-1 items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-expanded={isOffen}
                    aria-label={isOffen ? 'Details einklappen' : 'Details ausklappen'}
                    onClick={() => schalte(s.id)}
                  >
                    {isOffen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </Button>
                  <span className="text-sm font-medium">{s.bezeichnung || 'Neue Spalte'}</span>
                  {!isOffen && (
                    <span className="text-sm text-muted-foreground truncate">
                      {s.regel === undefined
                        ? `${s.erfassungsform === 'relativ' ? faktorZuProzent(s.vorgabewert ?? 0) : formatiereAggregat(rappenZuFranken(s.vorgabewert ?? 0))} ${s.erfassungsform === 'relativ' ? '%' : ''}`
                        : beschreibeStaffel(s, merkmale)}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Entfernt die Spalte und ihre Werte aus allen Einheiten."
                  aria-label="entfernen"
                  onClick={(e) => { e?.stopPropagation(); entferneSpalte(s.id); }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {/* Bezeichnung/Erfassungsform/Vorgabewert bleiben IMMER gemountet (siehe
                  Kopfkommentar) — nur `hidden` blendet sie aus. Die Regel-Konfiguration
                  eine Ebene tiefer bleibt dagegen echt bedingt gemountet: sie zieht mit
                  `BereichsregelEditor` ihre eigenen `ZellenEingabe`-Instanzen nach, die
                  sonst faelschlich als (nicht vorhandenes) Vorgabewert-Feld durchgingen. */}
              <div className={`border-t border-border/50 p-6 pt-2 ${isOffen ? '' : 'hidden'}`}>
                <div className="flex flex-col gap-6">
                  {/* Stage 1: Basic Config */}
                  <div className="flex flex-wrap items-end gap-6">
                    <div className="min-w-[200px] flex-1 space-y-2">
                      <Label htmlFor={`spalte-${s.id}-bezeichnung`}>Bezeichnung</Label>
                      <Input
                        id={`spalte-${s.id}-bezeichnung`}
                        className="h-9 w-full bg-background"
                        aria-label="Bezeichnung"
                        value={s.bezeichnung}
                        onChange={(e) => aktualisiere(s.id, { bezeichnung: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`spalte-${s.id}-erfassungsform`}>Erfassungsform</Label>
                      <Select
                        id={`spalte-${s.id}-erfassungsform`}
                        className="h-9 w-40"
                        aria-label="Erfassungsform"
                        value={s.erfassungsform}
                        onChange={(e) => aktualisiere(s.id, {
                          erfassungsform: e.target.value as AnpassungsSpalte['erfassungsform'],
                        })}
                      >
                        <option value="relativ">Prozent</option>
                        <option value="absolut">Franken</option>
                      </Select>
                    </div>

                    {s.regel === undefined && (
                      <div className="space-y-2">
                        <Label>Vorgabewert</Label>
                        <div className="flex items-center gap-2">
                          <div className="w-32">
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
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">
                            {s.erfassungsform === 'relativ' ? '%' : 'CHF'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stage 2: Rules / Actions — echt bedingt gemountet, siehe Kommentar oben. */}
                  {isOffen && (
                  <div className="rounded-md border border-border/50 bg-muted/10 p-4">
                    {s.regel === undefined ? (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium">Fester Vorgabewert</h4>
                          <p className="mt-1 max-w-md text-sm text-muted-foreground">
                            Der Zuschlag ist aktuell für alle Einheiten gleich. Sie können den Wert auf bestehende, leere Einheiten anwenden oder stattdessen eine Staffel nach Merkmal (z. B. Stockwerk) einführen.
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => uebernehmeAufEinheiten(s.id)}
                          >
                            Auf leere Zellen übernehmen
                          </Button>
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
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium">Staffel nach Merkmal</h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Der Wert variiert je Einheit anhand eines Merkmals.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => aendere(spalten.map((x) => (
                              x.id === s.id ? spalteOhneRegel(x) : x)))}
                          >
                            Staffel entfernen
                          </Button>
                        </div>
                        <div className="pt-2">
                          <BereichsregelEditor
                            regel={{
                              merkmal: s.regel.merkmal,
                              bereiche: normalisiereBereiche(s.regel.bereiche),
                            }}
                            merkmale={merkmale}
                            erfassungsform={s.erfassungsform}
                            aendere={(regel) => aendere(spalten.map((x) => (
                              x.id === s.id ? spalteMitGeaenderterRegel(x, regel) : x)))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </section>
  );
}
