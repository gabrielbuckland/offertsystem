'use client';

/**
 * Projektbezogene Einstellungen (Ebene 2). Zeigt die EFFEKTIVE Konfiguration, speichert
 * aber nur das DELTA zu den Firmenwerten: Waere die effektive Konfiguration gespeichert,
 * wuerde jedes Projekt beim ersten Speichern zur Vollkopie, eine spaetere Korrektur an
 * den Firmenwerten erreichte es nie mehr, und das Ueberschreibungsprotokoll (A-13)
 * meldete jeden Wert als abweichend.
 *
 * Der Entwurf (effektive Konfiguration im Formular) ist die einzige Wahrheit; das Delta
 * wird bei jedem Rendern neu berechnet (`bildeDelta`) statt als zweiter Zustand
 * mitgefuehrt — zwei Zustaende koennten auseinanderlaufen.
 *
 * Eigener Speicherpfad statt `verwendeEinstellungen`: dieser Hook speichert fest gegen
 * `POST /api/projekt/<id>/einstellungen` (Delta), nicht firmenweit. Die
 * generationsgesicherte Zustandsmaschine (`baueSpeicherSteuerung`) wird geteilt.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card.js';
import { Hinweis } from '../ui/hinweis.js';
import { rufeApi } from '../rufe-api.js';
import { rahmenBefunde } from './EinstellungsEditor.js';
import { istUebersteuert, setzeZurueck } from './herkunft.js';
import { bildeDelta, effektiveKonfiguration } from './projekt-einstellungen-logik.js';
import {
  baueSpeicherSteuerung,
  type EinstellungsBefund,
  type SpeicherErgebnis,
  type VerwendeEinstellungenErgebnis,
} from './verwende-einstellungen.js';
// Bewusst aus `app/(anwendung)/einstellungen/`: `components/einstellungen/` wird vom
// Architekturtest auf fest verdrahtete Konfigurationsbezeichner gescannt.
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
  // Netzausfall und Serverfehler ohne Befundform landen gemeinsam hier: kein Feldanker
  // fuer «Server nicht erreichbar» (I-24), also ein unabhaengiger Befund.
  return {
    ok: false,
    befunde: [{ pfad: '', text: 'Die Projekteinstellungen konnten nicht gespeichert werden.' }],
  };
}

/** Wurzelpfade eines Bereichs — ein Bereich kann mehrere umfassen (`bereiche.ts`). */
function wurzeln(praefix: string | readonly string[]): readonly string[] {
  return typeof praefix === 'string' ? [praefix] : praefix;
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
  // Zuletzt abgelegter Stand, normalisiert wie `bildeDelta` ihn schreiben wuerde. Der
  // rohe `delta`-Prop taugt nicht als Vergleichsbasis: eine wirkungslose leere Wurzel
  // darin meldete die Fussleiste schon beim Oeffnen faelschlich als Aenderung.
  const [abgelegt, setzeAbgelegt] = useState<Readonly<Record<string, unknown>>>(
    () => bildeDelta(anfang, firmenwerte),
  );
  const [speichert, setzeSpeichert] = useState(false);
  const [pruefsumme, setzePruefsumme] = useState<string | undefined>(undefined);
  const [befunde, setzeBefunde] = useState<readonly EinstellungsBefund[]>([]);

  const aktuellesDelta = useMemo(() => bildeDelta(entwurf, firmenwerte), [entwurf, firmenwerte]);
  const geaendert = JSON.stringify(aktuellesDelta) !== JSON.stringify(abgelegt);

  // Gesendeter Stand, damit `aufErgebnis` weiss, was der Erfolg bestaetigt.
  // `baueSpeicherSteuerung` verwirft ueberholte Antworten vor `aufErgebnis`.
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

  // Setzt eine Bereichswurzel auf den Firmenwert zurueck, ueber das Delta statt ueber
  // ein Zurueckkopieren: `setzeZurueck` raeumt leer gewordene Elternknoten mit ab und
  // entfernt so auch noch ungespeicherte Bearbeitung derselben Wurzel.
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
              <Editor einstellungen={zustand} />
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
