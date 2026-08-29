'use client';

/**
 * Projektbezogene Einstellungen (Ebene 2). Zeigt die EFFEKTIVE Konfiguration — sonst
 * saehe der Vermarkter ein leeres Formular und wuesste nicht, womit gerechnet wird —,
 * speichert aber das DELTA: Nur was von den Firmenwerten abweicht, geht in den Rumpf.
 *
 * Der Unterschied ist tragend. Waere die effektive Konfiguration gespeichert, wuerde
 * jedes Projekt beim ersten Speichern zur Vollkopie, eine spaetere Korrektur an den
 * Firmenwerten erreichte es nie mehr, und das Ueberschreibungsprotokoll — der Beleg
 * fuer A-13 — meldete jeden Wert als abweichend.
 *
 * Daraus folgt die Zustandsfuehrung: EINE Wahrheit ist der Entwurf (die effektive
 * Konfiguration, die im Formular steht); das Delta wird daraus bei jedem Rendern neu
 * gerechnet (`bildeDelta`) statt als zweiter Zustand mitgefuehrt. Zwei Zustaende
 * koennten auseinanderlaufen, und dann waere unklar, welcher von beiden die Anzeige und
 * welcher die Ablage bestimmt. Weil das Delta abgeleitet ist, meldet das
 * Herkunftsabzeichen auch eine noch NICHT gespeicherte Uebersteuerung bereits als
 * «projektbezogen» — genau die Aussage, die der Nutzer beim Bearbeiten braucht.
 *
 * Eigener Speicherpfad statt `verwendeEinstellungen`: Jener Hook schreibt fest gegen
 * `POST /api/einstellungen` und damit FIRMENWEIT. Hier geht der Rumpf an
 * `POST /api/projekt/<id>/einstellungen` und enthaelt das Delta, nicht den Entwurf. Die
 * generationsgesicherte Zustandsmaschine (`baueSpeicherSteuerung`) wird dagegen geteilt —
 * das Problem ueberholter Antworten ist an beiden Stellen dasselbe.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card.js';
import { Hinweis } from '../ui/hinweis.js';
import { rufeApi } from '../rufe-api.js';
import { rahmenBefunde } from './EinstellungsEditor.js';
import { istUebersteuert, setzeZurueck } from './herkunft.js';
import {
  bildeDelta, effektiveKonfiguration, unverankerteBefunde,
} from './projekt-einstellungen-logik.js';
import {
  baueSpeicherSteuerung,
  type EinstellungsBefund,
  type SpeicherErgebnis,
  type VerwendeEinstellungenErgebnis,
} from './verwende-einstellungen.js';
// Bewusst aus `app/(anwendung)/einstellungen/`: Die Bereichszuordnung ist
// Routing-Metadatum und bleibt dort, weil `components/einstellungen/` vom
// Architekturtest auf fest verdrahtete Konfigurationsbezeichner gescannt wird
// (Dateikommentar in `bereiche.ts`). Importiert, nicht verschoben.
import { BEREICHE } from '../../app/(anwendung)/einstellungen/bereiche.js';

export interface ProjektEinstellungenProps {
  readonly projektId: string;
  /** Ebene 1: die firmenweite Berechnungsbasis, unveraenderlich in dieser Ansicht. */
  readonly firmenwerte: Readonly<Record<string, unknown>>;
  /** Ebene 2: die bereits abgelegten projektbezogenen Abweichungen. */
  readonly delta: Readonly<Record<string, unknown>>;
}

interface SpeicherAntwort {
  readonly pruefsumme?: string;
  readonly befunde?: readonly EinstellungsBefund[];
}

/** Einziger Netzwerkkontakt dieser Komponente. Rumpf ist das DELTA. */
async function schreibeProjektEinstellungen(
  projektId: string, delta: Readonly<Record<string, unknown>>,
): Promise<SpeicherErgebnis> {
  const antwort = await rufeApi<SpeicherAntwort>(
    `/api/projekt/${encodeURIComponent(projektId)}/einstellungen`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(delta),
    },
  );
  if (antwort.ok) return { ok: true, pruefsumme: antwort.rumpf.pruefsumme };
  if (antwort.status === 422 && antwort.rumpf.befunde !== undefined) {
    return { ok: false, befunde: antwort.rumpf.befunde };
  }
  // Netzausfall (Status 0) und Serverfehler ohne Befundform landen gemeinsam hier: Es
  // gibt keinen Feldanker, dem sich «der Server ist nicht erreichbar» zuordnen liesse
  // (I-24) — also genau EIN unanhaengiger Befund. Gleiche Regel wie firmenweit.
  return {
    ok: false,
    befunde: [{ pfad: '', text: 'Die Projekteinstellungen konnten nicht gespeichert werden.' }],
  };
}

/** Wurzelpfade eines Bereichs — ein Bereich kann mehrere umfassen (`bereiche.ts`). */
function wurzeln(praefix: string | readonly string[]): readonly string[] {
  return typeof praefix === 'string' ? [praefix] : praefix;
}

/**
 * Auffangblock fuer Befunde, die KEINE Bereichskarte verankern kann — als eigene
 * Komponente, damit sich genau diese Anzeige ohne Zustandsmaschine und ohne
 * Hook-Testbibliothek rendern und pruefen laesst (`renderToStaticMarkup`).
 *
 * Der Pfad steht mit im Text: Ein ortloser Befund traegt sonst keinen Hinweis darauf,
 * WORAUF er sich bezieht — bei einem gesperrten Pfad (`api`) ist genau das die
 * Kerninformation.
 */
export function BefundAuffang(
  { befunde, wurzeln: bereichsWurzeln }: {
    readonly befunde: readonly EinstellungsBefund[];
    readonly wurzeln: readonly string[];
  },
) {
  const ortlos = unverankerteBefunde(befunde, bereichsWurzeln);
  if (ortlos.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nicht gespeichert</CardTitle>
        <CardDescription>Diese Befunde lassen sich keinem Feld zuordnen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ortlos.map((befund, index) => (
          <Hinweis key={`${befund.pfad}-${index}`} art="fehler">
            {`${befund.pfad}: ${befund.text}`}
          </Hinweis>
        ))}
      </CardContent>
    </Card>
  );
}

function Herkunftsabzeichen({ uebersteuert }: { readonly uebersteuert: boolean }) {
  return (
    <span
      className={uebersteuert
        ? 'rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'
        : 'rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'}
    >
      {uebersteuert ? 'projektbezogen' : 'firmenweit'}
    </span>
  );
}

export function ProjektEinstellungen({ projektId, firmenwerte, delta }: ProjektEinstellungenProps) {
  const anfang = useMemo(
    () => effektiveKonfiguration(firmenwerte, delta), [firmenwerte, delta],
  );
  const [entwurf, setzeEntwurf] = useState<Readonly<Record<string, unknown>>>(anfang);
  /**
   * Der zuletzt ABGELEGTE Stand — in normalisierter Form, also so, wie `bildeDelta` ihn
   * schreiben wuerde. Der rohe `delta`-Prop taugt nicht als Vergleichsbasis: Traege er
   * eine wirkungslose leere Wurzel, meldete die Fussleiste schon beim Oeffnen eine
   * Aenderung, die niemand vorgenommen hat.
   */
  const [abgelegt, setzeAbgelegt] = useState<Readonly<Record<string, unknown>>>(
    () => bildeDelta(anfang, firmenwerte),
  );
  const [speichert, setzeSpeichert] = useState(false);
  const [pruefsumme, setzePruefsumme] = useState<string | undefined>(undefined);
  const [befunde, setzeBefunde] = useState<readonly EinstellungsBefund[]>([]);

  const aktuellesDelta = useMemo(() => bildeDelta(entwurf, firmenwerte), [entwurf, firmenwerte]);
  const geaendert = JSON.stringify(aktuellesDelta) !== JSON.stringify(abgelegt);

  // Der gesendete Stand, damit `aufErgebnis` weiss, was der Erfolg bestaetigt. Ein
  // ueberholter Speicherversuch kann hier nicht falsch quittieren: `baueSpeicherSteuerung`
  // verwirft dessen Antwort, bevor `aufErgebnis` ueberhaupt laeuft.
  const gesendet = useRef<Readonly<Record<string, unknown>>>({});
  const steuerung = useRef<ReturnType<typeof baueSpeicherSteuerung> | undefined>(undefined);
  if (steuerung.current === undefined) {
    steuerung.current = baueSpeicherSteuerung(
      (rumpf) => schreibeProjektEinstellungen(projektId, rumpf),
      {
        aufSpeichertWechsel: setzeSpeichert,
        aufErgebnis: (ergebnis) => {
          if (ergebnis.ok) {
            setzeAbgelegt(gesendet.current);
            setzeBefunde([]);
            setzePruefsumme(ergebnis.pruefsumme);
          } else {
            setzeBefunde(ergebnis.befunde);
            setzePruefsumme(undefined);
          }
        },
      },
    );
  }

  const aendere = useCallback((naechster: Readonly<Record<string, unknown>>) => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(naechster);
    // Ein neuer Bearbeitungsschritt entwertet die letzte Rueckmeldung — sie galt einem
    // Entwurf, der jetzt ueberholt ist.
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, []);

  const speichere = useCallback(() => {
    gesendet.current = aktuellesDelta;
    steuerung.current?.starte(aktuellesDelta);
  }, [aktuellesDelta]);

  const verwerfe = useCallback(() => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(effektiveKonfiguration(firmenwerte, abgelegt));
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, [firmenwerte, abgelegt]);

  /**
   * Setzt EINE Bereichswurzel auf den Firmenwert zurueck. Der Weg fuehrt bewusst ueber
   * das Delta und nicht ueber ein Zurueckkopieren des Teilbaums: `setzeZurueck` raeumt
   * leer gewordene Elternknoten mit ab, und das anschliessende erneute Einlegen stellt
   * sicher, dass auch eine noch ungespeicherte Bearbeitung derselben Wurzel verschwindet.
   */
  const setzeWurzelZurueck = useCallback((pfad: string) => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(effektiveKonfiguration(firmenwerte, setzeZurueck(aktuellesDelta, pfad)));
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, [firmenwerte, aktuellesDelta]);

  // Genau die Form, die jeder Bereichs-Editor erwartet — derselbe Vertrag wie firmenweit
  // (`BereichsEditorProps`), nur mit projektbezogenem Speicherziel.
  const zustand: VerwendeEinstellungenErgebnis = {
    entwurf, geaendert, speichert, pruefsumme, befunde, aendere, speichere, verwerfe,
  };

  // Alle Bereichswurzeln zusammen — die Menge, gegen die der Auffangblock entscheidet,
  // ob ein Befund ueberhaupt irgendwo verankert erscheint.
  const alleWurzeln = Object.values(BEREICHE).flatMap((bereich) => wurzeln(bereich.praefix));

  return (
    <div className="flex flex-col gap-4">
      <Hinweis art="info">
        Angezeigt wird die Konfiguration, mit der dieses Projekt rechnet. Gespeichert
        werden nur die Abweichungen von den Firmenwerten — spätere Änderungen an einer
        nicht übersteuerten Firmeneinstellung wirken hier weiterhin.
      </Hinweis>

      {Object.entries(BEREICHE).map(([schluessel, bereich]) => {
        const praefixe = wurzeln(bereich.praefix);
        const bereichsBefunde = rahmenBefunde(befunde, praefixe);
        const Editor = bereich.Editor;
        return (
          <Card key={schluessel}>
            <CardHeader>
              <CardTitle>{bereich.titel}</CardTitle>
              <CardDescription>{bereich.zweck}</CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {praefixe.map((pfad) => {
                  const uebersteuert = istUebersteuert(aktuellesDelta, pfad);
                  return (
                    <span key={pfad} className="flex items-center gap-1">
                      {praefixe.length > 1 && (
                        <code className="text-xs text-muted-foreground">{pfad}</code>
                      )}
                      <Herkunftsabzeichen uebersteuert={uebersteuert} />
                      {uebersteuert && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setzeWurzelZurueck(pfad)}
                        >
                          Auf Firmenwert zurücksetzen
                        </Button>
                      )}
                    </span>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* `ebene="projekt"` sperrt genau die Aktionen, die das Delta-Modell nicht
                  ausdruecken kann (Entfernen eines Firmenschluessels) — siehe
                  `Bearbeitungsebene` in `verwende-einstellungen.ts`. */}
              <Editor einstellungen={zustand} ebene="projekt" />
              {bereichsBefunde.length > 0 && (
                <div className="space-y-2">
                  {bereichsBefunde.map((befund, index) => (
                    <Hinweis key={`${befund.pfad}-${index}`} art="fehler">{befund.text}</Hinweis>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Auffangblock: Befunde, die keine Bereichskarte verankern kann (gesperrter Pfad,
          Rumpffehler, unbekannter Wurzelschluessel). Ohne ihn bliebe ein abgelehntes
          Delta auf dem Bildschirm vollstaendig unsichtbar. */}
      <BefundAuffang befunde={befunde} wurzeln={alleWurzeln} />

      <Card>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-sm text-muted-foreground">Wirkt nur auf dieses Projekt.</p>
          <div className="flex items-center gap-2">
            {pruefsumme !== undefined && (
              <Hinweis art="erfolg">{`Prüfsumme ${pruefsumme}`}</Hinweis>
            )}
            <Button type="button" variant="outline" onClick={verwerfe} disabled={!geaendert}>
              Verwerfen
            </Button>
            <Button type="button" onClick={speichere} disabled={!geaendert || speichert}>
              {speichert ? 'Speichert …' : 'Speichern'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
