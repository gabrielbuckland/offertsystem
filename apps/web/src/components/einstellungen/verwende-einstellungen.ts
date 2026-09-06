'use client';

// US-08: bewusst ohne Autosave (anders als `verwendeProjekt`) — ein Schreibvorgang hier
// trifft die firmenweite Konfiguration und damit ALLE Projekte, ein Tippfehler duerfte
// nicht automatisch auf jede kuenftige Offerte durchschlagen.
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { rufeApi } from '../rufe-api.js';

export interface EinstellungsBefund {
  readonly pfad: string;
  readonly text: string;
}

// Steuert ausschliesslich das Entfernen eines Firmenschluessels aus `aufwandfaktoren.<id>`
// (einzige Aktion, die das Delta-Modell der Projektebene nicht ausdruecken kann, da
// `bildeDelta` einen fehlenden Schluessel als unveraendert liest). Der Knopf wird deshalb
// auf Projektebene gesperrt, nicht stillschweigend wirkungslos gelassen.
export type Bearbeitungsebene = 'firma' | 'projekt';

export interface BereichsEditorProps {
  readonly einstellungen: VerwendeEinstellungenErgebnis;
  /** Fehlt auf der firmenweiten Seite; dort gilt `'firma'` als Vorgabe. */
  readonly ebene?: Bearbeitungsebene | undefined;
}

export type BereichsEditor = (props: BereichsEditorProps) => ReactElement;

interface SpeicherAntwort {
  readonly pruefsumme?: string;
  readonly befunde?: readonly EinstellungsBefund[];
}

export type SpeicherErgebnis =
  | { readonly ok: true; readonly pruefsumme: string | undefined }
  | { readonly ok: false; readonly befunde: readonly EinstellungsBefund[] };

export interface VerwendeEinstellungenErgebnis {
  readonly entwurf: Readonly<Record<string, unknown>>;
  readonly geaendert: boolean;
  readonly speichert: boolean;
  readonly pruefsumme: string | undefined;
  readonly befunde: readonly EinstellungsBefund[];
  readonly aendere: (naechster: Readonly<Record<string, unknown>>) => void;
  readonly speichere: () => void;
  readonly verwerfe: () => void;
}

async function schreibeEinstellungen(
  entwurf: Readonly<Record<string, unknown>>,
): Promise<SpeicherErgebnis> {
  const antwort = await rufeApi<SpeicherAntwort>('/api/einstellungen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entwurf),
  });
  if (antwort.ok) return { ok: true, pruefsumme: antwort.rumpf.pruefsumme };
  if (antwort.status === 422 && antwort.rumpf.befunde !== undefined) {
    return { ok: false, befunde: antwort.rumpf.befunde };
  }
  // I-24: Netzausfall (status 0) und Serverfehler ohne `befunde`-Form landen hier
  // gemeinsam, da kein Feldanker existiert -> ein unabhaengiger Befund.
  return {
    ok: false,
    befunde: [{ pfad: '', text: 'Die Einstellungen konnten nicht gespeichert werden.' }],
  };
}

interface SpeicherBeobachter {
  readonly aufSpeichertWechsel: (speichert: boolean) => void;
  readonly aufErgebnis: (ergebnis: SpeicherErgebnis) => void;
}

// Generationszaehler sichert Speicherversuche gegen ueberholte Antworten ab:
// `vermerkeAenderung`/`starte` zaehlen hoch, eine Antwort mit veralteter Generation wird
// verworfen. `speichert` wird separat ueber `laufendeGeneration` nur von der zuletzt
// GESENDETEN Anfrage zurueckgesetzt, damit eine spaet eintreffende erste Antwort nicht
// den Ladezustand einer noch laufenden zweiten Anfrage herunterreisst.
export function baueSpeicherSteuerung(
  sende: (entwurf: Readonly<Record<string, unknown>>) => Promise<SpeicherErgebnis>,
  beobachter: SpeicherBeobachter,
) {
  let generation = 0;
  let laufendeGeneration: number | undefined;

  return {
    vermerkeAenderung(): void {
      generation += 1;
    },
    starte(entwurf: Readonly<Record<string, unknown>>): void {
      generation += 1;
      const meineGeneration = generation;
      laufendeGeneration = meineGeneration;
      beobachter.aufSpeichertWechsel(true);
      void sende(entwurf)
        .then((ergebnis) => {
          if (generation === meineGeneration) beobachter.aufErgebnis(ergebnis);
        })
        .finally(() => {
          if (laufendeGeneration === meineGeneration) beobachter.aufSpeichertWechsel(false);
        });
    },
  };
}

// Strukturvergleich statt Referenzvergleich: `aendere` liefert bei jedem Ruecksetzen auf
// den Ausgangswert eine neue Referenz, obwohl der Baum inhaltlich unveraendert ist.
export function entwurfGeaendert(
  entwurf: Readonly<Record<string, unknown>>, anfang: Readonly<Record<string, unknown>>,
): boolean {
  return JSON.stringify(entwurf) !== JSON.stringify(anfang);
}

export function verwendeEinstellungen(
  anfang: Readonly<Record<string, unknown>>,
): VerwendeEinstellungenErgebnis {
  const [entwurf, setzeEntwurf] = useState(anfang);
  const [speichert, setzeSpeichert] = useState(false);
  const [pruefsumme, setzePruefsumme] = useState<string | undefined>(undefined);
  const [befunde, setzeBefunde] = useState<readonly EinstellungsBefund[]>([]);

  const steuerung = useRef<ReturnType<typeof baueSpeicherSteuerung> | undefined>(undefined);
  if (steuerung.current === undefined) {
    steuerung.current = baueSpeicherSteuerung(schreibeEinstellungen, {
      aufSpeichertWechsel: setzeSpeichert,
      aufErgebnis: (ergebnis) => {
        if (ergebnis.ok) {
          setzeBefunde([]);
          setzePruefsumme(ergebnis.pruefsumme);
        } else {
          setzeBefunde(ergebnis.befunde);
          setzePruefsumme(undefined);
        }
      },
    });
  }

  const geaendert = entwurfGeaendert(entwurf, anfang);

  const aendere = useCallback((naechster: Readonly<Record<string, unknown>>) => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(naechster);
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, []);

  const speichere = useCallback(() => {
    steuerung.current?.starte(entwurf);
  }, [entwurf]);

  const verwerfe = useCallback(() => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(anfang);
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, [anfang]);

  return { entwurf, geaendert, speichert, pruefsumme, befunde, aendere, speichere, verwerfe };
}

// Ein leerer Pfad ist der Netz-/500-Fallback aus `schreibeEinstellungen` (kein Feldanker)
// und muss deshalb bei jedem Bereich sichtbar werden, sonst verschwaende ein
// gescheiterter Speicherversuch spurlos.
export function befundeFuerPfad(
  befunde: readonly EinstellungsBefund[], praefix: string,
): readonly EinstellungsBefund[] {
  return befunde.filter((befund) => befund.pfad === ''
    || befund.pfad === praefix
    || befund.pfad.startsWith(`${praefix}.`)
    || befund.pfad.startsWith(`${praefix}[`));
}
