'use client';

/**
 * Editor fuer «Preisanpassung & Vorlagen» (Task 15) — deckt DREI unabhaengige
 * Konfigurationswurzeln ab (`flaeche`, `preisanpassung`, `anpassungsVorlagen`), siehe
 * `BEREICHE.preisanpassung.praefix` in `[bereich]/page.tsx`. Der Editor kennt nur die
 * FORM dieser Teilbaeume (lokale, schmale Typisierungen), keine Konfigurationsbezeichner
 * — der Server prueft beim Speichern die eigentliche Wahrheit.
 *
 * `begruendungPflicht` erscheint als gesperrte Zeile ohne Eingabeelement: Die
 * Begruendungspflicht ist eine fachliche Vorgabe (Spec §6), kein einstellbarer Wert —
 * ein Eingabefeld dafuer wuerde eine Wahlmoeglichkeit vortaeuschen, die es nicht gibt.
 */
import { Trash2 } from 'lucide-react';
import { Fragment, type ReactElement } from 'react';
import type { Bereichsregel, Merkmal } from '@offert/core';
import { faktorZuProzent, prozentZuFaktor } from '../projekt/zellen-logik.js';
import { ZellenEingabe } from '../projekt/ZellenEingabe.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Hinweis } from '../ui/hinweis.js';
import { Select } from '../ui/select.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { befundeFuerPfad, type BereichsEditorProps } from './verwende-einstellungen.js';
import { BereichsregelEditor } from './BereichsregelEditor.js';
import { MerkmalEditor } from './MerkmalEditor.js';

interface FlaecheRoh {
  readonly alpha: number;
}

interface PreisanpassungRoh {
  readonly zMin: number;
  readonly zMax: number;
  readonly begruendungPflicht: boolean;
  readonly begruendungMinLaenge: number;
}

interface VorlageRoh {
  readonly id: string;
  readonly bezeichnung: string;
  readonly vorgabefaktor: number;
  readonly erfassungsform: 'relativ' | 'absolut';
  readonly begruendungVorschlag: string;
  /** Traegt die Vorlage eine Regel, ist `vorgabefaktor` zwingend 0 (Ebene 3) — die
   *  Eingabe dafuer wird deshalb ausgeblendet statt nur deaktiviert. */
  readonly regel?: Bereichsregel;
}

const SPALTENANZAHL = 6;

/** Kleinbuchstaben, Nicht-Alphanumerisches zu `_` — wie bei bestehenden Vorlagen-IDs
 *  in der Konfiguration (z. B. `erdgeschoss_gartensitzplatz`). */
function ableiteVorlagenId(bezeichnung: string): string {
  return bezeichnung.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function PreisanpassungEditor({ einstellungen }: BereichsEditorProps): ReactElement {
  const flaeche = einstellungen.entwurf['flaeche'] as FlaecheRoh;
  const preisanpassung = einstellungen.entwurf['preisanpassung'] as PreisanpassungRoh;
  const vorlagen = einstellungen.entwurf['anpassungsVorlagen'] as readonly VorlageRoh[];
  const merkmale = einstellungen.entwurf['merkmale'] as readonly Merkmal[];

  function schreibe(
    teilbaum: Partial<Record<'flaeche' | 'preisanpassung' | 'anpassungsVorlagen' | 'merkmale', unknown>>,
  ): void {
    einstellungen.aendere({ ...einstellungen.entwurf, ...teilbaum });
  }

  function aendereAlpha(wert: number): void {
    schreibe({ flaeche: { ...flaeche, alpha: wert } });
  }

  function aenderePreisanpassung(feld: 'zMin' | 'zMax' | 'begruendungMinLaenge', wert: number): void {
    schreibe({ preisanpassung: { ...preisanpassung, [feld]: wert } });
  }

  function aendereMerkmale(naechste: readonly Merkmal[]): void {
    schreibe({ merkmale: naechste });
  }

  function aendereVorlage(index: number, naechste: Partial<VorlageRoh>): void {
    schreibe({
      anpassungsVorlagen: vorlagen.map((vorlage, i) => (i === index ? { ...vorlage, ...naechste } : vorlage)),
    });
  }

  function entferneVorlage(index: number): void {
    schreibe({ anpassungsVorlagen: vorlagen.filter((_, i) => i !== index) });
  }

  function fuegeVorlageHinzu(): void {
    const bezeichnung = 'Neue Vorlage';
    schreibe({
      anpassungsVorlagen: [
        ...vorlagen,
        {
          id: ableiteVorlagenId(bezeichnung), bezeichnung, vorgabefaktor: 0,
          erfassungsform: 'relativ', begruendungVorschlag: '',
        },
      ],
    });
  }

  function aendereRegel(index: number, regel: Bereichsregel): void {
    schreibe({ anpassungsVorlagen: vorlagen.map((v, i) => (i === index ? { ...v, regel } : v)) });
  }

  /**
   * Schaltet die Regel je Vorlage EIN/AUS statt sie ueber `aendereVorlage` (blosses
   * Merge-Patch) zu setzen: Ein Merge kann das Feld `regel` setzen, aber nicht wieder
   * entfernen — und bei aktiver Regel muss `vorgabefaktor` zwingend 0 sein (Ebene 3),
   * sonst weist die Konfiguration die Vorlage als «Regel und Vorgabewert nebeneinander»
   * zurueck.
   */
  function schalteRegel(index: number, aktiv: boolean): void {
    schreibe({
      anpassungsVorlagen: vorlagen.map((v, i) => {
        if (i !== index) return v;
        if (!aktiv) {
          const { regel: _entfernt, ...ohneRegel } = v;
          return ohneRegel;
        }
        const regel: Bereichsregel = { merkmal: merkmale[0]?.id ?? '', bereiche: [{ wert: 0 }] };
        return { ...v, vorgabefaktor: 0, regel };
      }),
    });
  }

  const flaecheBefunde = befundeFuerPfad(einstellungen.befunde, 'flaeche');
  const preisanpassungBefunde = befundeFuerPfad(einstellungen.befunde, 'preisanpassung');

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-semibold">Gewicht der Aussenfläche</h3>
        <p className="text-sm text-muted-foreground">Gewicht der Aussenfläche in der gewichteten Fläche.</p>
        <div className="max-w-[10rem] space-y-1">
          <Label>α</Label>
          <ZellenEingabe wert={flaeche.alpha} aendere={aendereAlpha} />
        </div>
        {flaecheBefunde.map((befund, i) => (
          <Hinweis key={`${befund.pfad}-${i}`} art="fehler">{befund.text}</Hinweis>
        ))}
      </section>

      <section className="space-y-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-semibold">Grenzen der Zu-/Abschläge</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>z min (%)</Label>
            <ZellenEingabe
              wert={faktorZuProzent(preisanpassung.zMin)}
              aendere={(wert) => aenderePreisanpassung('zMin', prozentZuFaktor(wert))}
            />
          </div>
          <div className="space-y-1">
            <Label>z max (%)</Label>
            <ZellenEingabe
              wert={faktorZuProzent(preisanpassung.zMax)}
              aendere={(wert) => aenderePreisanpassung('zMax', prozentZuFaktor(wert))}
            />
          </div>
          <div className="space-y-1">
            <Label>Mindestlänge Begründung</Label>
            <ZellenEingabe
              wert={preisanpassung.begruendungMinLaenge}
              aendere={(wert) => aenderePreisanpassung('begruendungMinLaenge', wert)}
            />
          </div>
        </div>
        {/* Keine Checkbox, kein Schalter: der Wert ist fachlich fix (Spec §6), kein
            einstellbarer Zustand. */}
        <p className="text-sm text-muted-foreground">
          Die Begründungspflicht ist aktiv und fachlich nicht abschaltbar.
        </p>
        {preisanpassungBefunde.map((befund, i) => (
          <Hinweis key={`${befund.pfad}-${i}`} art="fehler">{befund.text}</Hinweis>
        ))}
      </section>

      <MerkmalEditor merkmale={merkmale} aendere={aendereMerkmale} />

      <section className="space-y-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-semibold">Vorlagen</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Erfassungsform</TableHead>
              <TableHead>Vorgabefaktor (%) / Regel</TableHead>
              <TableHead>Begründungsvorschlag</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vorlagen.map((vorlage, index) => {
              const zeilenBefunde = befundeFuerPfad(einstellungen.befunde, `anpassungsVorlagen[${index}]`);
              const regelAktiv = vorlage.regel !== undefined;
              return (
                // Index statt `id` als Key: zwei frisch hinzugefuegte, noch unbenannte
                // Vorlagen tragen kurzzeitig dieselbe abgeleitete ID.
                <Fragment key={index}>
                  <TableRow>
                    <TableCell>
                      {/* Nur lesend: `id` ist Referenzziel von `vorlageId` in bestehenden
                          Offerten und darf nicht ueber diesen Editor veraendert werden. */}
                      <Input value={vorlage.id} readOnly disabled className="h-8 w-full" />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={vorlage.bezeichnung}
                        onChange={(e) => aendereVorlage(index, { bezeichnung: e.target.value })}
                        className="h-8 w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={vorlage.erfassungsform}
                        onChange={(e) => aendereVorlage(
                          index, { erfassungsform: e.target.value as VorlageRoh['erfassungsform'] },
                        )}
                      >
                        <option value="relativ">Prozent</option>
                        <option value="absolut">Franken</option>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={regelAktiv}
                            onChange={(e) => schalteRegel(index, e.target.checked)}
                          />
                          Regel verwenden
                        </label>
                        {/* Bei aktiver Regel bestimmt die Staffel den Wert — die Eingabe
                            wird ausgeblendet statt nur gesperrt, sonst weist Ebene 3 die
                            Konfiguration ab («Regel und Vorgabewert nebeneinander»). */}
                        {!regelAktiv && (
                          <ZellenEingabe
                            wert={faktorZuProzent(vorlage.vorgabefaktor)}
                            aendere={(wert) => aendereVorlage(index, { vorgabefaktor: prozentZuFaktor(wert) })}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={vorlage.begruendungVorschlag}
                        onChange={(e) => aendereVorlage(index, { begruendungVorschlag: e.target.value })}
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
                        onClick={() => entferneVorlage(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {regelAktiv && vorlage.regel !== undefined && (
                    <TableRow>
                      <TableCell colSpan={SPALTENANZAHL} className="pt-0">
                        <BereichsregelEditor
                          regel={vorlage.regel}
                          merkmale={merkmale}
                          erfassungsform={vorlage.erfassungsform}
                          aendere={(regel) => aendereRegel(index, regel)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {zeilenBefunde.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={SPALTENANZAHL} className="space-y-2 pt-0">
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
        <Button type="button" variant="outline" onClick={fuegeVorlageHinzu}>
          Vorlage hinzufügen
        </Button>
      </section>
    </div>
  );
}
