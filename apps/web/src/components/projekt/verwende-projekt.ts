'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Projekt } from '../../server/projekt-schema.js';
import { rufeApi } from '../rufe-api.js';

const ENTPRELLUNG_MS = 400;

export type Speicherfunktion = (projekt: Projekt) => Promise<boolean>;

export interface Speicherwarteschlange {
  readonly stelleEin: (projekt: Projekt) => void;
}

export interface WarteschlangenBeobachter {
  readonly aufStatusWechsel: (speichernLaeuft: boolean) => void;
  readonly aufFehler: (fehlgeschlagen: boolean) => void;
  // Nur bei ERFOLGREICHEM Sendevorgang: bei fehlgeschlagenem PUT traegt die Platte nicht
  // den Stand, den der Bildschirm zeigt.
  readonly aufErfolg?: (projekt: Projekt) => void;
}

// Hoechstens ein Speicherversuch gleichzeitig; trifft waehrend eines laufenden Versuchs
// ein neuerer Stand ein, wird nur der NEUESTE vorgemerkt und danach gesendet. Noetig, da
// der Server den zuletzt ANKOMMENDEN Schreibvorgang gewinnen laesst, nicht den zuletzt
// GESENDETEN — ein AbortController loest das nicht, da ein bereits empfangenes aelteres
// PUT trotzdem zu Ende geschrieben wird.
export function baueSpeicherwarteschlange(
  sende: Speicherfunktion,
  beobachter: WarteschlangenBeobachter,
): Speicherwarteschlange {
  let laeuft = false;
  let ausstehend: Projekt | undefined;

  function starte(projekt: Projekt): void {
    laeuft = true;
    beobachter.aufStatusWechsel(true);
    void sende(projekt)
      .then((ok) => {
        beobachter.aufFehler(!ok);
        if (ok) beobachter.aufErfolg?.(projekt);
      })
      .catch(() => beobachter.aufFehler(true))
      .finally(() => {
        const naechstes = ausstehend;
        ausstehend = undefined;
        if (naechstes === undefined) {
          laeuft = false;
          beobachter.aufStatusWechsel(false);
        } else {
          starte(naechstes);
        }
      });
  }

  return {
    stelleEin(projekt: Projekt) {
      if (laeuft) {
        ausstehend = projekt;
        return;
      }
      starte(projekt);
    },
  };
}

async function schreibeUeberPut(projekt: Projekt): Promise<boolean> {
  const { ok } = await rufeApi<unknown>(`/api/projekt/${projekt.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projekt),
  });
  return ok;
}

// Speichert entprellt: jede Zelleingabe loest sonst je Zeichen einen Schreibvorgang aus.
export function verwendeProjekt(anfang: Projekt, aufGespeichert?: (projekt: Projekt) => void) {
  const [projekt, setzeProjekt] = useState(anfang);
  const [speichernLaeuft, setzeSpeichern] = useState(false);
  const [speichernFehler, setzeSpeichernFehler] = useState<string | undefined>(undefined);
  const zeitgeber = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Ref-Umweg haelt aufGespeichert aktuell, obwohl die Warteschlange nur einmal entsteht.
  const rueckruf = useRef(aufGespeichert);
  rueckruf.current = aufGespeichert;
  const warteschlange = useRef<Speicherwarteschlange | undefined>(undefined);
  if (warteschlange.current === undefined) {
    warteschlange.current = baueSpeicherwarteschlange(schreibeUeberPut, {
      aufStatusWechsel: setzeSpeichern,
      aufFehler: (fehlgeschlagen) => setzeSpeichernFehler(
        fehlgeschlagen
          ? 'Die letzte Änderung konnte nicht gespeichert werden. Bitte Verbindung prüfen '
            + 'und Eingabe erneut auslösen.'
          : undefined,
      ),
      aufErfolg: (gespeichert) => rueckruf.current?.(gespeichert),
    });
  }

  const aendere = useCallback((naechster: Projekt) => {
    setzeProjekt(naechster);
    if (zeitgeber.current !== undefined) clearTimeout(zeitgeber.current);
    zeitgeber.current = setTimeout(() => {
      warteschlange.current?.stelleEin(naechster);
    }, ENTPRELLUNG_MS);
  }, []);

  useEffect(() => () => {
    if (zeitgeber.current !== undefined) clearTimeout(zeitgeber.current);
  }, []);

  return { projekt, aendere, speichernLaeuft, speichernFehler };
}
