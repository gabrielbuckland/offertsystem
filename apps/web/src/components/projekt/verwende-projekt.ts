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
  /**
   * Wird nach einem ERFOLGREICHEN Sendevorgang mit genau dem Stand aufgerufen, der
   * gesendet wurde. Damit laesst sich Nachgelagertes an das Speichern KETTEN, statt es
   * parallel dazu zu starten.
   *
   * Nur bei Erfolg: Ist das PUT fehlgeschlagen, traegt die Platte den Stand nicht, den
   * der Bildschirm zeigt. Eine Berechnung darauf ergaebe Zahlen zu einem Stand, den der
   * Server nie gesehen hat — der Speicherfehler bleibt stehen und ist die richtige
   * Auskunft.
   */
  readonly aufErfolg?: (projekt: Projekt) => void;
}

/**
 * Sorgt dafuer, dass hoechstens ein Speicherversuch gleichzeitig unterwegs ist. Trifft
 * waehrend eines laufenden Versuchs ein neuerer Stand ein, wird nur dieser (der
 * NEUESTE) vorgemerkt und nach Abschluss gesendet — nicht jeder Zwischenstand.
 *
 * Noetig, weil `schreibeAtomar` (projekt-ablage.ts) den zuletzt ANKOMMENDEN Schreib-
 * vorgang gewinnen laesst, nicht den zuletzt GESENDETEN: Ohne diese Sequenzierung kann
 * ein spaeter geaendertes, aber schneller beantwortetes PUT von einem aelteren,
 * langsameren PUT ueberschrieben werden. Ein `AbortController` loest das nicht — er
 * verhindert nur, dass der Client auf die Antwort wartet, nicht dass der Server das
 * bereits empfangene, aeltere PUT trotzdem zu Ende schreibt.
 *
 * Als reine Funktion getrennt vom React-State, weil dieses Repo keine
 * Hook-Testbibliothek (kein jsdom/testing-library, `environment: 'node'` in
 * vitest.workspace.ts) fuehrt und sich die Reihenfolge so ohne DOM direkt testen laesst.
 */
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

/** Einziger Netzwerkkontakt der Speicherung, ueber `rufeApi` (Spec §3). `ok` bleibt false
 *  bei HTTP-Fehlern UND bei geworfenen Ausnahmen (Netzausfall) — beides ist fuer die
 *  Warteschlange ein Fehlschlag; der Rumpf wird hier nicht gebraucht. */
async function schreibeUeberPut(projekt: Projekt): Promise<boolean> {
  const { ok } = await rufeApi<unknown>(`/api/projekt/${projekt.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projekt),
  });
  return ok;
}

/**
 * Haelt den Projektstand und speichert ihn entprellt.
 *
 * Entprellt, weil jede Zelleingabe einen Tastendruck ausloest; ungebremst entstuende je
 * Zeichen ein Schreibvorgang auf dieselbe Datei. `speichernFehler` macht einen
 * fehlgeschlagenen Speicherversuch sichtbar — ohne diese Rueckmeldung verlöre der
 * Vermarkter Aenderungen, ohne es zu merken, was schlimmer ist als gar kein
 * automatisches Speichern (Design-Spec §2).
 *
 * `aufGespeichert` meldet den geschriebenen Stand. Wer nach dem Speichern etwas tun muss,
 * das den Stand VON DER PLATTE liest, haengt sich hier an, statt einen eigenen Zeitgeber
 * parallel laufen zu lassen.
 */
export function verwendeProjekt(anfang: Projekt, aufGespeichert?: (projekt: Projekt) => void) {
  const [projekt, setzeProjekt] = useState(anfang);
  const [speichernLaeuft, setzeSpeichern] = useState(false);
  const [speichernFehler, setzeSpeichernFehler] = useState<string | undefined>(undefined);
  const zeitgeber = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Die Warteschlange entsteht genau einmal und schliesst damit ueber den Rueckruf des
  // ERSTEN Rendervorgangs. Der Umweg ueber die Referenz haelt sie am jeweils aktuellen.
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
