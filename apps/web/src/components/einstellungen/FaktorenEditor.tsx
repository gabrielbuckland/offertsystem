'use client';

/**
 * Editor fuer den Teilbaum `aufwandfaktoren` — Herkunft, Normalisierung und Gewichtung der
 * Faktoren, aus denen sich der Aufwandindikator D ergibt (Spec §6).
 *
 * Kennt nur die FORM des Teilbaums (`FaktorRoh`), keine Konfigurationsbezeichner — ein
 * Architekturtest scannt diesen Ordner auf woertlich verdrahtete Bezeichner. Die neun
 * gueltigen `lagescore`-Quellschluessel (PriceHubble, I-26) erscheinen deshalb NUR als
 * Platzhaltertext, nie in einer Verzweigung des Codes.
 */
import { Trash2 } from 'lucide-react';
import { Fragment, useState, type ReactElement } from 'react';
import { faktorZuProzent, prozentZuFaktor } from '../projekt/zellen-logik.js';
import { ZellenEingabe } from '../projekt/ZellenEingabe.js';
import { Button } from '../ui/button.js';
import { Hinweis } from '../ui/hinweis.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Slider } from '../ui/slider.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { neuerManuellerFaktor, renormalisiereGewichte } from './faktoren-logik.js';
import { befundeFuerPfad, type BereichsEditorProps } from './verwende-einstellungen.js';

interface Stufe {
  readonly wert: number;
  readonly bezeichnung: string;
}

interface FaktorRoh {
  readonly bezeichnung: string;
  readonly quelle: 'lagescore' | 'manuell' | 'abgeleitet';
  readonly quellSchluessel: string;
  readonly strategie: 'minmax' | 'zscore';
  readonly min: number;
  readonly max: number;
  readonly gewicht: number;
  readonly skala?: { readonly form: 'ordinal'; readonly stufen: readonly Stufe[] };
}

type AufwandfaktorenRoh = Readonly<Record<string, FaktorRoh>>;

/** Bezeichnermuster der Konfiguration: Kleinbuchstabe zuerst, danach alphanumerisch/`_`. */
const SCHLUESSEL_MUSTER = /^[a-z][a-zA-Z0-9_]*$/;

export function FaktorenEditor({ einstellungen, ebene = 'firma' }: BereichsEditorProps): ReactElement {
  const faktoren = einstellungen.entwurf['aufwandfaktoren'] as AufwandfaktorenRoh;
  // Das Entfernen eines Faktors ist auf der Projektebene nicht ausdrueckbar (Delta-Modell,
  // `Bearbeitungsebene`); HINZUFUEGEN dagegen schon — `aufwandfaktoren` ist im Kern-Merge
  // eine offene Wurzel und traegt neue Schluessel.
  const entfernenMoeglich = ebene === 'firma';
  const [neuerSchluessel, setzeNeuerSchluessel] = useState('');
  const [neueQuelle, setzeNeueQuelle] = useState<'manuell' | 'lagescore'>('manuell');
  const [neuerQuellSchluessel, setzeNeuerQuellSchluessel] = useState('');

  function schreibeFaktoren(naechste: AufwandfaktorenRoh): void {
    einstellungen.aendere({ ...einstellungen.entwurf, aufwandfaktoren: naechste });
  }

  function aendereFaktor(schluessel: string, naechster: Partial<FaktorRoh>): void {
    schreibeFaktoren({ ...faktoren, [schluessel]: { ...faktoren[schluessel]!, ...naechster } });
  }

  function entferneFaktor(schluessel: string): void {
    const { [schluessel]: _entfernt, ...rest } = faktoren;
    schreibeFaktoren(rest);
  }

  function fuegeFaktorHinzu(): void {
    const schluessel = neuerSchluessel.trim();
    if (schluessel.length === 0 || !SCHLUESSEL_MUSTER.test(schluessel) || schluessel in faktoren) return;
    const rohgeruest = neuerManuellerFaktor(schluessel);
    const faktor: FaktorRoh = neueQuelle === 'lagescore'
      ? { ...rohgeruest, quelle: 'lagescore', quellSchluessel: neuerQuellSchluessel.trim() }
      : rohgeruest;
    schreibeFaktoren({ ...faktoren, [schluessel]: faktor });
    setzeNeuerSchluessel('');
    setzeNeuerQuellSchluessel('');
  }

  function renormalisiere(): void {
    schreibeFaktoren(renormalisiereGewichte(faktoren));
  }

  function aendereStufe(schluessel: string, index: number, naechste: Partial<Stufe>): void {
    const faktor = faktoren[schluessel]!;
    const stufen = (faktor.skala?.stufen ?? []).map((stufe, i) => (
      i === index ? { ...stufe, ...naechste } : stufe
    ));
    aendereFaktor(schluessel, { skala: { form: 'ordinal', stufen } });
  }

  function entferneStufe(schluessel: string, index: number): void {
    const faktor = faktoren[schluessel]!;
    const stufen = (faktor.skala?.stufen ?? []).filter((_, i) => i !== index);
    aendereFaktor(schluessel, { skala: { form: 'ordinal', stufen } });
  }

  function fuegeStufeHinzu(schluessel: string): void {
    const faktor = faktoren[schluessel]!;
    const stufen = [...(faktor.skala?.stufen ?? []), { wert: 0, bezeichnung: '' }];
    aendereFaktor(schluessel, { skala: { form: 'ordinal', stufen } });
  }

  const gewichtssumme = Object.values(faktoren).reduce((summe, faktor) => summe + faktor.gewicht, 0);
  // Gleitkomma-Rauschen (0.1 + 0.2 !== 0.3) darf die Warnung nicht faelschlich ausloesen.
  const summeStimmt = Math.abs(gewichtssumme - 1) < 1e-6;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <p className={summeStimmt ? 'text-sm' : 'text-sm font-semibold text-destructive'}>
          Gewichtssumme: {(gewichtssumme * 100).toFixed(2)} %
          {!summeStimmt && ', muss genau 100 % ergeben'}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={renormalisiere}>
          Gewichte renormalisieren
        </Button>
      </div>

      {Object.entries(faktoren).sort(([a], [b]) => a.localeCompare(b)).map(([schluessel, faktor]) => {
        const zeilenBefunde = befundeFuerPfad(einstellungen.befunde, `aufwandfaktoren.${schluessel}`);
        return (
          <Fragment key={schluessel}>
            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
                  {faktor.quelle}
                </span>
                {entfernenMoeglich ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    title="Projekte, die diesen Faktor erfasst haben, behalten den Wert; er geht nicht mehr in D ein."
                    onClick={() => entferneFaktor(schluessel)}
                  >
                    entfernen
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Entfernen ist nur firmenweit möglich: Ein Projekt speichert seine
                    Abweichungen und kann einen Firmenwert übersteuern, nicht streichen.
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <Label>Bezeichnung</Label>
                  <Input
                    value={faktor.bezeichnung}
                    onChange={(e) => aendereFaktor(schluessel, { bezeichnung: e.target.value })}
                    className="h-8 w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Min</Label>
                  <ZellenEingabe wert={faktor.min} aendere={(wert) => aendereFaktor(schluessel, { min: wert })} />
                </div>
                <div className="space-y-1">
                  <Label>Max</Label>
                  <ZellenEingabe wert={faktor.max} aendere={(wert) => aendereFaktor(schluessel, { max: wert })} />
                </div>
                <div className="space-y-1">
                  <Label>Gewicht (%)</Label>
                  <ZellenEingabe
                    wert={faktorZuProzent(faktor.gewicht)}
                    aendere={(wert) => aendereFaktor(schluessel, { gewicht: prozentZuFaktor(wert) })}
                  />
                  {/* Ein Anteil an der Gewichtssumme ist ein beschraenkter, kontinuierlich
                      verstellbarer Wert (0..100 %) — der Schieberegler ergaenzt das
                      Zahlenfeld um den passenden Ziehsinn, ersetzt es aber nicht: ein
                      exakter Prozentwert (z. B. 33.33 %) laesst sich am Regler kaum treffen. */}
                  <Slider
                    min={0}
                    max={100}
                    step={0.01}
                    value={faktorZuProzent(faktor.gewicht)}
                    onChange={(e) => aendereFaktor(schluessel, { gewicht: prozentZuFaktor(Number(e.target.value)) })}
                    aria-label={`Gewicht ${faktor.bezeichnung} in Prozent`}
                  />
                </div>
              </div>
              {faktor.quelle === 'lagescore' && (
                // Min/Max duerfen bei einem Lagescore VERTAUSCHT stehen: die Reihenfolge
                // traegt die Polung, ein Tausch waere ein fachlicher Fehler, kein Tippfehler.
                <p className="text-sm text-muted-foreground">
                  Min kann hier grösser als Max sein: Die Reihenfolge legt die Polung
                  des Lagescores fest (steigt der Aufwand mit dem Rohwert oder sinkt
                  er). Nicht «korrigierend» vertauschen.
                </p>
              )}
              {faktor.skala !== undefined && (
                <div className="space-y-2">
                  <Label>Ordinalstufen</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wert</TableHead>
                        <TableHead>Bezeichnung</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faktor.skala.stufen.map((stufe, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <ZellenEingabe
                              wert={stufe.wert}
                              aendere={(wert) => aendereStufe(schluessel, index, { wert })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={stufe.bezeichnung}
                              onChange={(e) => aendereStufe(schluessel, index, { bezeichnung: e.target.value })}
                              className="h-8 w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="entfernen"
                              onClick={() => entferneStufe(schluessel, index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button type="button" variant="outline" size="sm" onClick={() => fuegeStufeHinzu(schluessel)}>
                    Stufe hinzufügen
                  </Button>
                </div>
              )}
              {zeilenBefunde.length > 0 && (
                <div className="space-y-2">
                  {zeilenBefunde.map((befund, i) => (
                    <Hinweis key={`${befund.pfad}-${i}`} art="fehler">{befund.text}</Hinweis>
                  ))}
                </div>
              )}
            </div>
          </Fragment>
        );
      })}

      <div className="space-y-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-semibold">Faktor hinzufügen</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Schlüssel</Label>
            <Input
              value={neuerSchluessel}
              onChange={(e) => setzeNeuerSchluessel(e.target.value)}
              className="h-8 w-full"
              placeholder="z. B. aussenraum"
            />
          </div>
          <div className="space-y-1">
            <Label>Quelle</Label>
            <select
              value={neueQuelle}
              onChange={(e) => setzeNeueQuelle(e.target.value as 'manuell' | 'lagescore')}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="manuell">manuell</option>
              <option value="lagescore">lagescore</option>
            </select>
          </div>
          {neueQuelle === 'lagescore' && (
            <div className="space-y-1">
              <Label>Quellschlüssel</Label>
              <Input
                value={neuerQuellSchluessel}
                onChange={(e) => setzeNeuerQuellSchluessel(e.target.value)}
                className="h-8 w-full"
                placeholder="location, family, health, leisure, shopping, catering, view, noise oder nuisance"
              />
            </div>
          )}
        </div>
        <Button type="button" variant="outline" onClick={fuegeFaktorHinzu}>
          Faktor hinzufügen
        </Button>
      </div>
    </div>
  );
}
