'use client';

// Editor fuer den Teilbaum `honorar` (Stuetzstellen der Honorarstaffel + Skalierung g(D)).
// Kennt nur die Form des Teilbaums, keine Konfigurationsbezeichner — der Server prueft die
// eigentliche Wahrheit (Luecklosigkeit, Degression) beim Speichern; ein Verstoss kommt als
// Befund mit Pfad `honorar.stuetzstellen[i].<feld>` zurueck und wird hier an dieser Zeile
// verankert (`befundeFuerPfad`), Spec §6.
import { Trash2 } from 'lucide-react';
import { Fragment, type ReactElement } from 'react';
import { frankenZuRappen, rappenZuFranken } from '../projekt/zellen-logik.js';
import { ZellenEingabe } from '../projekt/ZellenEingabe.js';
import { Button } from '../ui/button.js';
import { Hinweis } from '../ui/hinweis.js';
import { Label } from '../ui/label.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { befundeFuerPfad, type BereichsEditorProps } from './verwende-einstellungen.js';

interface Stuetzstelle {
  readonly v: number;
  readonly hMin: number;
  readonly hMax: number;
}

interface HonorarRoh {
  readonly stuetzstellen: readonly Stuetzstelle[];
  readonly skalierung: { readonly form: string; readonly gMin: number; readonly gMax: number };
}

type Feld = keyof Stuetzstelle;

export function HonorarEditor({ einstellungen }: BereichsEditorProps): ReactElement {
  const honorar = einstellungen.entwurf['honorar'] as HonorarRoh;

  function schreibeHonorar(naechste: HonorarRoh): void {
    einstellungen.aendere({ ...einstellungen.entwurf, honorar: naechste });
  }

  // Betraege liegen in `entwurf` als Rappen vor (E-09) — jedes Feld rechnet an dieser
  // einen Stelle in Franken um (Anzeige) bzw. zurueck in Rappen (Ablage).
  function aendereStuetzstelle(index: number, feld: Feld, wertFranken: number): void {
    const stuetzstellen = honorar.stuetzstellen.map((stuetzstelle, i) => (
      i === index ? { ...stuetzstelle, [feld]: frankenZuRappen(wertFranken) } : stuetzstelle
    ));
    schreibeHonorar({ ...honorar, stuetzstellen });
  }

  function entferneStuetzstelle(index: number): void {
    schreibeHonorar({
      ...honorar,
      stuetzstellen: honorar.stuetzstellen.filter((_, i) => i !== index),
    });
  }

  // Neue Zeile uebernimmt die letzten Werte als Ausgangspunkt — der Auftraggeber passt
  // sie an; Luecklosigkeit/Degression erzwingt erst die Validierung beim Speichern.
  function fuegeStuetzstelleHinzu(): void {
    const letzte = honorar.stuetzstellen[honorar.stuetzstellen.length - 1];
    const neue: Stuetzstelle = letzte !== undefined ? { ...letzte } : { v: 0, hMin: 0, hMax: 0 };
    schreibeHonorar({ ...honorar, stuetzstellen: [...honorar.stuetzstellen, neue] });
  }

  function aendereSkalierung(feld: 'gMin' | 'gMax', wert: number): void {
    schreibeHonorar({ ...honorar, skalierung: { ...honorar.skalierung, [feld]: wert } });
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>V-Grenze (CHF)</TableHead>
            <TableHead>H min (CHF)</TableHead>
            <TableHead>H max (CHF)</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {honorar.stuetzstellen.map((stuetzstelle, index) => {
            const zeilenBefunde = befundeFuerPfad(einstellungen.befunde, `honorar.stuetzstellen[${index}]`);
            return (
              // Fragment statt zweier freistehender <tr>: die Befundzeile gehoert
              // sichtbar zur Stuetzstelle darueber, nicht zu einer Sammelstelle.
              <Fragment key={index}>
                <TableRow>
                  <TableCell>
                    <ZellenEingabe
                      wert={rappenZuFranken(stuetzstelle.v)}
                      aendere={(wert) => aendereStuetzstelle(index, 'v', wert)}
                    />
                  </TableCell>
                  <TableCell>
                    <ZellenEingabe
                      wert={rappenZuFranken(stuetzstelle.hMin)}
                      aendere={(wert) => aendereStuetzstelle(index, 'hMin', wert)}
                    />
                  </TableCell>
                  <TableCell>
                    <ZellenEingabe
                      wert={rappenZuFranken(stuetzstelle.hMax)}
                      aendere={(wert) => aendereStuetzstelle(index, 'hMax', wert)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="entfernen"
                      onClick={() => entferneStuetzstelle(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                {zeilenBefunde.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="space-y-2 pt-0">
                      {zeilenBefunde.map((befund, i) => (
                        <Hinweis key={`${befund.pfad}-${i}`} art="fehler">{befund.text}</Hinweis>
                      ))}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <Button type="button" variant="outline" onClick={fuegeStuetzstelleHinzu}>
        Stützstelle hinzufügen
      </Button>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>g min</Label>
          <ZellenEingabe wert={honorar.skalierung.gMin} aendere={(wert) => aendereSkalierung('gMin', wert)} />
        </div>
        <div className="space-y-1">
          <Label>g max</Label>
          <ZellenEingabe wert={honorar.skalierung.gMax} aendere={(wert) => aendereSkalierung('gMax', wert)} />
        </div>
      </div>
    </div>
  );
}
