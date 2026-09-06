'use client';

// Zeigt die EFFEKTIVE Konfiguration, speichert aber nur das DELTA zu den Firmenwerten:
// wuerde die effektive Konfiguration gespeichert, wuerde jedes Projekt beim ersten
// Speichern zur Vollkopie und eine spaetere Korrektur an den Firmenwerten erreichte es
// nie mehr (A-13). Das Delta wird bei jedem Rendern aus dem Entwurf neu berechnet
// (`bildeDelta`) statt als zweiter Zustand mitgefuehrt.
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card.js';
import { Hinweis } from '../ui/hinweis.js';
import { rufeApi } from '../rufe-api.js';
import { rahmenBefunde } from './EinstellungsEditor.js';
import { JsonReiter } from './JsonReiter.js';
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
import { BEREICHE, wurzeln } from '../../app/(anwendung)/einstellungen/bereiche.js';

export interface ProjektEinstellungenProps {
  readonly projektId: string;
  readonly firmenwerte: Readonly<Record<string, unknown>>;
  readonly delta: Readonly<Record<string, unknown>>;
}

interface SpeicherAntwort {
  readonly pruefsumme?: string;
  readonly befunde?: readonly EinstellungsBefund[];
}

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
  // I-24: Netzausfall/Serverfehler ohne Feldanker -> unabhaengiger Befund.
  return {
    ok: false,
    befunde: [{ pfad: '', text: 'Die Projekteinstellungen konnten nicht gespeichert werden.' }],
  };
}

type Reiter = 'formular' | 'json';

// Zweite Achse nur auf Projektebene: bearbeitet wird das DELTA, zur Kontrolle ansehen
// laesst sich die EFFEKTIVE Konfiguration (nur lesend, siehe Dateikopf/A-13).
type JsonSicht = 'delta' | 'effektiv';

const REITER: ReadonlyArray<{ readonly wert: Reiter; readonly beschriftung: string }> = [
  { wert: 'formular', beschriftung: 'Formular' },
  { wert: 'json', beschriftung: 'JSON' },
];

const JSON_SICHTEN: ReadonlyArray<{ readonly wert: JsonSicht; readonly beschriftung: string }> = [
  { wert: 'delta', beschriftung: 'Abweichungen (bearbeitbar)' },
  { wert: 'effektiv', beschriftung: 'Effektive Konfiguration (nur lesend)' },
];

// Eigene Komponente, damit sie ohne Zustandsmaschine/Hook-Testbibliothek pruefbar ist
// (`renderToStaticMarkup`). Pfad steht mit im Text, sonst fehlt bei z.B. gesperrtem Pfad
// (`api`) der Hinweis, worauf sich der Befund bezieht.
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
  // Normalisiert wie `bildeDelta`; der rohe `delta`-Prop taugt nicht als Vergleichsbasis,
  // eine wirkungslose leere Wurzel darin meldete die Fussleiste sonst faelschlich als Aenderung.
  const [abgelegt, setzeAbgelegt] = useState<Readonly<Record<string, unknown>>>(
    () => bildeDelta(anfang, firmenwerte),
  );
  const [reiter, setzeReiter] = useState<Reiter>('formular');
  const [jsonSicht, setzeJsonSicht] = useState<JsonSicht>('delta');
  const [speichert, setzeSpeichert] = useState(false);
  const [pruefsumme, setzePruefsumme] = useState<string | undefined>(undefined);
  const [befunde, setzeBefunde] = useState<readonly EinstellungsBefund[]>([]);

  const aktuellesDelta = useMemo(() => bildeDelta(entwurf, firmenwerte), [entwurf, firmenwerte]);
  const geaendert = JSON.stringify(aktuellesDelta) !== JSON.stringify(abgelegt);

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

  const setzeWurzelZurueck = useCallback((pfad: string) => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(effektiveKonfiguration(firmenwerte, setzeZurueck(aktuellesDelta, pfad)));
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, [firmenwerte, aktuellesDelta]);

  const zustand: VerwendeEinstellungenErgebnis = {
    entwurf, geaendert, speichert, pruefsumme, befunde, aendere, speichere, verwerfe,
  };

  const alleWurzeln = Object.values(BEREICHE).flatMap((bereich) => wurzeln(bereich.praefix));

  return (
    <div className="flex flex-col gap-4">
      <Hinweis art="info">
        Angezeigt wird die Konfiguration, mit der dieses Projekt rechnet. Gespeichert
        werden nur die Abweichungen von den Firmenwerten — spätere Änderungen an einer
        nicht übersteuerten Firmeneinstellung wirken hier weiterhin.
      </Hinweis>

      <div role="tablist" aria-label="Darstellung" className="flex gap-1">
        {REITER.map((eintrag) => (
          <Button
            key={eintrag.wert}
            type="button"
            role="tab"
            aria-selected={reiter === eintrag.wert}
            variant={reiter === eintrag.wert ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setzeReiter(eintrag.wert)}
          >
            {eintrag.beschriftung}
          </Button>
        ))}
      </div>

      {reiter === 'json' && (
        <Card>
          <CardHeader>
            <CardTitle>JSON</CardTitle>
            <CardDescription>
              Derselbe Entwurfsstand wie im Formular — die Fussleiste speichert in beiden
              Ansichten dasselbe.
            </CardDescription>
            <div role="tablist" aria-label="JSON-Sicht" className="flex gap-1 pt-2">
              {JSON_SICHTEN.map((eintrag) => (
                <Button
                  key={eintrag.wert}
                  type="button"
                  role="tab"
                  aria-selected={jsonSicht === eintrag.wert}
                  variant={jsonSicht === eintrag.wert ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setzeJsonSicht(eintrag.wert)}
                >
                  {eintrag.beschriftung}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {jsonSicht === 'delta'
                ? 'Nur die Abweichungen von den Firmenwerten — genau das, was abgelegt wird.'
                : 'Die zusammengeführte Konfiguration, mit der gerechnet wird. Nur lesend; '
                  + 'bearbeitet wird das Delta.'}
            </p>
            {/* `key` erzwingt Neuaufsetzen beim Umschalten: `JsonReiter` haelt den Rohtext
                lokal und uebernaehme den Wechsel der Sicht sonst nicht. */}
            <JsonReiter
              key={jsonSicht}
              wert={jsonSicht === 'delta' ? aktuellesDelta : entwurf}
              aendere={(naechstesDelta) => aendere(
                effektiveKonfiguration(firmenwerte, naechstesDelta),
              )}
              schreibbar={jsonSicht === 'delta'}
              befunde={befunde}
            />
          </CardContent>
        </Card>
      )}

      {reiter === 'formular' && Object.entries(BEREICHE).map(([schluessel, bereich]) => {
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
              {/* `ebene="projekt"` sperrt das Entfernen eines Aufwandfaktors (Delta-Modell,
                  siehe `Bearbeitungsebene` in `verwende-einstellungen.ts`). */}
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
