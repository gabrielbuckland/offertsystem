'use client';

// NFA-12, I-27: Abruf je Zeile ist ein eigener Klick (`rufeAb`), keine Nebenwirkung des
// Renderns — verbraucht Anbieter-Guthaben.
// `aendere` traegt Referenzobjekte UND Einheiten in einem Aufruf: zwei unabhaengige
// Aufrufe im selben Tick liefen gegen denselben alten `projekt`-Stand (React batcht
// State-Updates ohne Re-Render dazwischen).
import { RefreshCw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatiereAggregat } from '@offert/offer';
import type { DossierDefaults } from '@offert/core';
import { erzeugeEinheiten } from '../../server/einheiten-generator.js';
import type { AnpassungsSpalte, ProjektEinheit, Referenzobjekt } from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select } from '../ui/select.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import {
  anzahlWohnungenAusEntwurf, naechsteId, neuesReferenzobjekt, verfuegbareZimmerzahlen,
} from './referenzobjekte-logik.js';
import { entscheideZellenwert } from './zellen-logik.js';
import { ZellenEingabe } from './ZellenEingabe.js';

export interface ReferenzobjekteProps {
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly einheiten: readonly ProjektEinheit[];
  readonly spalten: readonly AnpassungsSpalte[];
  readonly dossierDefaults: DossierDefaults;
  // undefined solange Baujahr nicht erfasst; neues Referenzobjekt bekommt dann 0.
  readonly baujahr: number | undefined;
  readonly aendere: (
    referenzobjekte: readonly Referenzobjekt[], einheiten: readonly ProjektEinheit[],
  ) => void;
  readonly rufeAb: (referenzobjektId: string) => void;
  readonly abrufLaufend: string | undefined;
}

function ersetze(
  referenzobjekte: readonly Referenzobjekt[], index: number, naechstes: Referenzobjekt,
): readonly Referenzobjekt[] {
  return referenzobjekte.map((r, i) => (i === index ? naechstes : r));
}

// Zahlen laufen ueber `ZellenEingabe`, damit ein geleertes Feld verworfen wird statt
// auf 0 zu fallen — bei der Zimmerzahl waere die erfundene 0 schemawidrig (`min(1)`).
export function Referenzobjekte({
  referenzobjekte, einheiten, spalten, dossierDefaults, baujahr, aendere, rufeAb, abrufLaufend,
}: ReferenzobjekteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [entwurfZimmerzahl, setzeEntwurfZimmerzahl] = useState<number | undefined>(undefined);
  const [entwurfWohnflaeche, setzeEntwurfWohnflaeche] = useState('');
  const [entwurfAnzahl, setzeEntwurfAnzahl] = useState('');

  function setzeMerkmal(
    index: number,
    patch: Partial<Referenzobjekt['parametrisierung']>,
  ): void {
    const r = referenzobjekte[index]!;
    aendere(ersetze(referenzobjekte, index, {
      ...r, parametrisierung: { ...r.parametrisierung, ...patch },
    }), einheiten);
  }

  function verwendetVon(id: string): number {
    return einheiten.filter((e) => e.referenzobjektId === id).length;
  }

  const optionen = verfuegbareZimmerzahlen(referenzobjekte);

  function oeffneDialog(): void {
    setzeEntwurfZimmerzahl(optionen[0]);
    setzeEntwurfWohnflaeche('');
    setzeEntwurfAnzahl('');
    dialogRef.current?.showModal();
  }

  const wohnflaecheEntscheid = entscheideZellenwert(entwurfWohnflaeche);
  const wohnflaecheGueltig = wohnflaecheEntscheid.art === 'uebernehmen' && wohnflaecheEntscheid.wert > 0;

  function fuegeHinzu(): void {
    if (entwurfZimmerzahl === undefined || wohnflaecheEntscheid.art !== 'uebernehmen'
      || wohnflaecheEntscheid.wert <= 0) return;
    const neues = neuesReferenzobjekt(
      entwurfZimmerzahl, wohnflaecheEntscheid.wert, naechsteId(referenzobjekte), baujahr ?? 0,
      dossierDefaults.zustandsbewertungen, dossierDefaults.qualitaetsbewertungen);
    const naechsteReferenzobjekte = [...referenzobjekte, neues];
    const anzahl = anzahlWohnungenAusEntwurf(entwurfAnzahl);
    // erzeugeEinheiten erkennt die Wunsch-referenzobjektId nur, wenn sie in der Liste
    // steht — daher naechsteReferenzobjekte (mit neues), nicht referenzobjekte.
    const neueEinheiten = anzahl === 0 ? [] : erzeugeEinheiten(
      [{ referenzobjektId: neues.id, anzahl }], naechsteReferenzobjekte, einheiten, spalten);
    aendere(naechsteReferenzobjekte, [...einheiten, ...neueEinheiten]);
    dialogRef.current?.close();
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold">Referenzobjekte</h2>
        <p className="text-sm text-muted-foreground">
          Je Wohnungstyp eine Referenzbewertung als Ausgangswert der Preisableitung.
        </p>
      </div>
      <dialog
        ref={dialogRef}
        aria-label="Referenzobjekt hinzufügen"
        // m-auto noetig: Tailwind-Preflight setzt margin:0 und ueberschreibt sonst die
        // UA-Regel dialog:modal { margin: auto }.
        className="m-auto rounded-lg border border-border bg-background p-6 backdrop:bg-foreground/30"
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="referenzobjekt-zimmerzahl">Zimmerzahl</Label>
            <Select
              id="referenzobjekt-zimmerzahl"
              value={entwurfZimmerzahl ?? ''}
              onChange={(e) => setzeEntwurfZimmerzahl(Number(e.target.value))}
            >
              {optionen.map((z) => (
                <option key={z} value={z}>{z} Zimmer</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="referenzobjekt-wohnflaeche">Wohnfläche (m²)</Label>
            <Input
              id="referenzobjekt-wohnflaeche"
              type="number"
              value={entwurfWohnflaeche}
              onChange={(e) => setzeEntwurfWohnflaeche(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="referenzobjekt-anzahl">Anzahl Wohnungen (optional)</Label>
            <Input
              id="referenzobjekt-anzahl"
              type="number"
              min={0}
              step={1}
              placeholder="0"
              value={entwurfAnzahl}
              onChange={(e) => setzeEntwurfAnzahl(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
            Abbrechen
          </Button>
          <Button type="button" onClick={fuegeHinzu} disabled={!wohnflaecheGueltig}>
            Hinzufügen
          </Button>
        </div>
      </dialog>
      {referenzobjekte.length === 0 ? (
        <p className="text-muted-foreground">Noch kein Referenzobjekt erfasst.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zimmerzahl</TableHead>
              <TableHead>Wohnfläche (m²)</TableHead>
              <TableHead>Referenzwert</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {referenzobjekte.map((r, index) => {
              const verwendungen = verwendetVon(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <ZellenEingabe
                      wert={r.zimmerzahl}
                      aendere={(zimmerzahl) => aendere(
                        ersetze(referenzobjekte, index, { ...r, zimmerzahl }), einheiten)}
                    />
                  </TableCell>
                  <TableCell>
                    <ZellenEingabe
                      wert={r.parametrisierung.flaecheInnen}
                      aendere={(flaecheInnen) => setzeMerkmal(index, { flaecheInnen })}
                    />
                  </TableCell>
                  <TableCell>
                    {r.bewertung === undefined ? 'nicht bezogen' : formatiereAggregat(r.bewertung.wert)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={abrufLaufend !== undefined}
                      title="Bewertung für dieses Referenzobjekt beziehen (verbraucht API-Guthaben)."
                      aria-label="Bewertung beziehen"
                      onClick={() => rufeAb(r.id)}
                    >
                      <RefreshCw
                        className={`size-4 ${abrufLaufend === r.id ? 'animate-spin' : ''}`}
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={verwendungen > 0}
                      title={verwendungen > 0
                        ? `Wird von ${verwendungen} Einheit${verwendungen === 1 ? '' : 'en'} verwendet.`
                        : undefined}
                      aria-label="entfernen"
                      onClick={() => aendere(referenzobjekte.filter((_, i) => i !== index), einheiten)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      )}
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          disabled={optionen.length === 0}
          title={optionen.length === 0
            ? 'Alle unterscheidbaren Zimmerzahlen sind vergeben.' : undefined}
          onClick={oeffneDialog}
        >
          Referenzobjekt hinzufügen
        </Button>
      </div>
    </section>
  );
}
