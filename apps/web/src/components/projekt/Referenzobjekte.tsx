'use client';

/**
 * Erster Block der Detailseite (Design-Spec §4): Referenzobjekte je Wohnungstyp mit
 * ihren bezogenen Bewertungen. Der Abruf ist ein eigener Klick (`rufeAb`), keine
 * Nebenwirkung des Renderns — er verbraucht Anbieter-Guthaben (NFA-12, I-27), das darf
 * nicht beim blossen Anzeigen der Seite geschehen.
 *
 * Der Anlegen-Dialog fragt neben Zimmerzahl und Wohnflaeche optional auch gleich die
 * Anzahl Wohnungen dieses Typs ab und erzeugt sie ueber `erzeugeEinheiten` mit (Rueck-
 * meldung Auftraggeber: der separate, vorgelagerte Block "Einheiten anlegen" entfaellt
 * dafuer als ERSTER Schritt). `aendere` traegt deshalb BEIDE Arrays auf einmal statt nur
 * `referenzobjekte`: Ein zweiter, unabhaengiger Aufruf gegen `einheiten` liefe im selben
 * Tick gegen den noch alten `projekt`-Stand der aufrufenden Seite und liesse den
 * jeweils anderen Aufruf verschwinden (React batcht State-Updates, es gibt zwischen den
 * beiden keinen Re-Render). `EinheitenGenerator` bleibt daneben bestehen, jetzt aber
 * unterhalb der Einheitentabelle — fuer das Nacherfassen weiterer Wohnungen eines
 * bereits bestehenden Typs.
 *
 * KEINE aufklappbare Detailzeile mehr (Rueckmeldung Auftraggeber, ehemals
 * `ParametrisierungsDetail.tsx`, entfernt): Baujahr gilt jetzt PROJEKTWEIT
 * (`ProjektBasisinformationen.tsx`) statt je Referenzobjekt; Zustand und Qualitaet
 * gelten bei Neubauprojekten firmenweit als feststehend
 * (`dossierDefaults.zustandsbewertungen`/`.qualitaetsbewertungen`, s. `config/README.md`);
 * Energielabel, Anzahl Badezimmer, Lift und
 * Heizungsart bleiben bei ihren Platzhaltern, weil PriceHubble sie nicht als
 * Pflichtfelder fuehrt (Rueckmeldung Auftraggeber). `dossierDefaults` bleibt deshalb
 * eine Prop dieser Komponente — nicht mehr fuer eine Herkunftsauszeichnung, sondern als
 * Quelle von Zustand/Qualitaet fuer neu angelegte Referenzobjekte (`fuegeHinzu`).
 */
import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatiereAggregat } from '@offert/offer';
import type { DossierDefaults } from '@offert/core';
import { erzeugeEinheiten } from '../../server/einheiten-generator.js';
import type { AnpassungsSpalte, ProjektEinheit, Referenzobjekt } from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select } from '../ui/select.js';
import { StatusZeile } from '../ui/status-zeile.js';
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
  // Vorbelegung neu erzeugter Einheiten (Task 10, `einheiten-generator.ts`) — dieselbe
  // Rolle wie in `EinheitenGenerator`.
  readonly spalten: readonly AnpassungsSpalte[];
  // Quelle von Zustand/Qualitaet neuer Referenzobjekte (`fuegeHinzu`), s. Dateikommentar.
  readonly dossierDefaults: DossierDefaults;
  // Projektweites Baujahr (`ProjektBasisinformationen.tsx`) — `undefined`, solange es
  // noch nicht erfasst ist; ein neues Referenzobjekt bekommt dann 0 (derselbe
  // Platzhalter wie zuvor, kein erfundenes Baujahr).
  readonly baujahr: number | undefined;
  readonly aendere: (
    referenzobjekte: readonly Referenzobjekt[], einheiten: readonly ProjektEinheit[],
  ) => void;
  readonly rufeAb: () => void;
  readonly abrufLaeuft: boolean;
}

/** Ersetzt genau ein Referenzobjekt; die uebrigen bleiben referenzgleich. */
function ersetze(
  referenzobjekte: readonly Referenzobjekt[], index: number, naechstes: Referenzobjekt,
): readonly Referenzobjekt[] {
  return referenzobjekte.map((r, i) => (i === index ? naechstes : r));
}

/**
 * Die Merkmale, die den Wohnungstyp bestimmen, sind an Ort und Stelle editierbar
 * (Design-Spec §4). Ohne sie liesse sich ueber die Oberflaeche nur EIN Wohnungstyp
 * fuehren: Jedes weitere Referenzobjekt truege die Vorgaben des ersten, und der Kern
 * wiese das Paar mit ZIMMERZAHL_MEHRFACH zurueck — das Mehrtypenmodell, auf dem die
 * ganze Auslegung beruht, waere durch die Oberflaeche nicht erreichbar.
 *
 * Bewusst nicht alle zehn Felder der `parametrisierung`, und ohne Stockwerk (das bei
 * einem Referenzobjekt immer 0 ist, s. o.): Erfasst wird in der Hauptzeile nur, was den
 * Typ unterscheidet und in die Bewertungsanfrage eingeht. Zahlen laufen ueber
 * `ZellenEingabe`, damit ein geleertes Feld verworfen wird, statt auf 0 zu fallen
 * (`entscheideZellenwert`) — bei der Zimmerzahl waere die erfundene 0 zudem ein
 * schemawidriger Wert (`min(1)`).
 */
export function Referenzobjekte({
  referenzobjekte, einheiten, spalten, dossierDefaults, baujahr, aendere, rufeAb, abrufLaeuft,
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

  // Wird ausserhalb des Klick-Handlers berechnet, damit die Schaltflaeche VOR dem Klick
  // schon weiss, ob noch eine unterscheidbare Zimmerzahl frei ist.
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
    // `erzeugeEinheiten` erkennt eine Wunsch-`referenzobjektId` nur, wenn sie in der
    // uebergebenen Referenzobjekt-Liste steht — deshalb `naechsteReferenzobjekte`
    // (mit `neues`), nicht das alte `referenzobjekte`.
    const neueEinheiten = anzahl === 0 ? [] : erzeugeEinheiten(
      [{ referenzobjektId: neues.id, anzahl }], naechsteReferenzobjekte, einheiten, spalten);
    aendere(naechsteReferenzobjekte, [...einheiten, ...neueEinheiten]);
    dialogRef.current?.close();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Referenzobjekte</h2>
          <p className="text-sm text-muted-foreground">
            Je Wohnungstyp eine Referenzbewertung — sie ist der Ausgangswert der Preisableitung.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {abrufLaeuft ? (
            <StatusZeile text="Bewertungen werden bezogen…" />
          ) : (
            <>
              <span className="text-xs text-muted-foreground">verbraucht API-Guthaben</span>
              <Button type="button" variant="outline" onClick={rufeAb}>
                Bewertungen beziehen
              </Button>
            </>
          )}
          <Button
            type="button"
            disabled={optionen.length === 0}
            title={optionen.length === 0
              ? 'Alle unterscheidbaren Zimmerzahlen sind vergeben.' : undefined}
            onClick={oeffneDialog}
          >
            Referenzobjekt hinzufügen
          </Button>
        </div>
      </div>
      <dialog
        ref={dialogRef}
        aria-label="Referenzobjekt hinzufügen"
        // `m-auto` haelt die Zentrierung explizit: Tailwinds Preflight setzt `margin: 0`
        // auf praktisch jedes Element und ueberschreibt damit die UA-Voreinstellung
        // `dialog:modal { margin: auto }`, die ein natives `<dialog>` sonst zentriert
        // (der Effekt betrifft `NeuesProjekt.tsx`s Dialog ebenso, dort mitkorrigiert).
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
    </section>
  );
}
